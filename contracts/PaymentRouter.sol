// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, euint256, externalEuint64, externalEuint256} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PaymentRouter
 * @notice Handles in-chat payment actions: /send, /request, /escrow, and /split.
 *
 * Design notes:
 *  - euint64 is used for encrypted amounts; euint256 for encrypted notes and terms.
 *  - Escrow approval flags are plaintext booleans — no synchronous decrypt needed.
 *  - Both sender and recipient must be registered for all payment functions.
 *  - Arbitrator registration is enforced in createEscrow().
 *  - A system message is emitted to MessageStore after each payment action.
 *  - Protocol fee is deducted from token transfers, not from escrow deposits.
 */
contract PaymentRouter is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────────────────────────
    //  Types & Constants
    // ──────────────────────────────────────────────────────────────────

    uint16 public constant MAX_FEE_BPS = 1000; // 10%
    uint256 public constant MAX_SPLIT_PARTICIPANTS = 5;

    struct PaymentRequest {
        address requester;
        address payer;
        address token; // address(0) = ETH
        uint256 amount; // plaintext amount (user-specified)
        euint64 encryptedAmount; // FHE-encrypted version for privacy
        euint256 encryptedNote;
        bool fulfilled;
        uint256 createdAt;
    }

    struct Escrow {
        address depositor;
        address beneficiary;
        address arbitrator;
        address token;
        uint256 amount;
        euint256 encryptedTerms;
        // FIX: plaintext approval flags — no synchronous decrypt needed
        bool depositorApproved;
        bool beneficiaryApproved;
        bool released;
        bool refunded;
        uint256 createdAt;
    }

    struct SplitPayment {
        address initiator;
        address[] participants;
        address token;
        uint256 totalAmount;
        uint256 perParticipant;
        euint256 encryptedNote;
        mapping(address => bool) paid;
        bool settled;
        uint256 createdAt;
    }

    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    IIdentityRegistry public immutable identityRegistry;
    IMessageStore public immutable messageStore;

    address public protocolFeeRecipient;
    uint16 public feeBps;

    uint256 public nextRequestId;
    uint256 public nextEscrowId;
    uint256 public nextSplitId;

    mapping(uint256 => PaymentRequest) public paymentRequests;
    mapping(uint256 => Escrow) public escrows;
    mapping(uint256 => SplitPayment) private splits;

    // ──────────────────────────────────────────────────────────────────
    //  Events (metadata only, no plaintext amounts in sensitive paths)
    // ──────────────────────────────────────────────────────────────────

    event PaymentSent(
        address indexed from,
        address indexed to,
        address token,
        uint256 amount,
        uint256 timestamp
    );
    event RequestCreated(
        uint256 indexed requestId,
        address indexed requester,
        address indexed payer,
        address token
    );
    event RequestFulfilled(uint256 indexed requestId);
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed depositor,
        address indexed beneficiary,
        address arbitrator
    );
    event EscrowApproved(uint256 indexed escrowId, address indexed approver);
    event EscrowReleased(uint256 indexed escrowId);
    event EscrowRefunded(uint256 indexed escrowId);
    event SplitCreated(
        uint256 indexed splitId,
        address indexed initiator,
        address token,
        uint256 totalAmount
    );
    event SplitContributed(
        uint256 indexed splitId,
        address indexed contributor
    );
    event SplitSettled(uint256 indexed splitId);
    event FeeBpsUpdated(uint16 newFeeBps);

    // ──────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────

    error SenderNotRegistered();
    error RecipientNotRegistered();
    error ArbitratorNotRegistered();
    error InsufficientETH();
    error TokenTransferFailed();
    error RequestNotFound();
    error RequestAlreadyFulfilled();
    error NotPayer();
    error EscrowNotFound();
    error EscrowAlreadySettled();
    error NotEscrowParty();
    error BothApproved();
    error SplitNotFound();
    error TooManyParticipants();
    error AlreadyPaid();
    error SplitAlreadySettled();
    error NotSplitParticipant();
    error FeeTooHigh();

    // ──────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────

    constructor(
        address _messageStore,
        address _identityRegistry,
        address _protocolFeeRecipient,
        uint16 _feeBps
    ) Ownable(msg.sender) {
        require(_feeBps <= MAX_FEE_BPS, "fee too high");
        messageStore = IMessageStore(_messageStore);
        identityRegistry = IIdentityRegistry(_identityRegistry);
        protocolFeeRecipient = _protocolFeeRecipient;
        feeBps = _feeBps;
    }

    // ──────────────────────────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────────────────────────

    function setFeeBps(uint16 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
        emit FeeBpsUpdated(_feeBps);
    }

    function setProtocolFeeRecipient(address recipient) external onlyOwner {
        protocolFeeRecipient = recipient;
    }

    // ──────────────────────────────────────────────────────────────────
    //  /send ETH
    // ──────────────────────────────────────────────────────────────────

    function sendETH(
        address payable recipient,
        externalEuint256 noteHandle,
        bytes calldata inputProof
    ) external payable nonReentrant {
        if (!identityRegistry.isRegistered(msg.sender))
            revert SenderNotRegistered();
        if (!identityRegistry.isRegistered(recipient))
            revert RecipientNotRegistered();
        if (msg.value == 0) revert InsufficientETH();

        euint256 note = FHE.fromExternal(noteHandle, inputProof);
        FHE.allowThis(note);
        FHE.allow(note, msg.sender);
        FHE.allow(note, recipient);

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 netVal = msg.value - fee;

        if (fee > 0) {
            (bool feeOk, ) = protocolFeeRecipient.call{value: fee}("");
            require(feeOk, "fee transfer failed");
        }

        (bool ok, ) = recipient.call{value: netVal}("");
        require(ok, "ETH transfer failed");

        // System message in thread
        messageStore.sendSystemMessage(
            msg.sender,
            recipient,
            keccak256(abi.encodePacked("ETH", msg.value, block.timestamp)),
            1
        );

        emit PaymentSent(
            msg.sender,
            recipient,
            address(0),
            msg.value,
            block.timestamp
        );
    }

    // ──────────────────────────────────────────────────────────────────
    //  /send ETH — Level 1 confidential (encrypted amount + note)
    //
    //  The ETH transfer still happens via msg.value (on-chain transfer),
    //  but the amount is ALSO stored FHE-encrypted (euint64) in the ACL
    //  so only sender and recipient can decrypt it via userDecrypt.
    //  The note (euint256) is encrypted as before.
    //
    //  Both handles share a single inputProof generated by the frontend
    //  via encryptPaymentRequest (add64 then add256 in one pass).
    // ──────────────────────────────────────────────────────────────────

    function sendETHConfidential(
        address payable recipient,
        externalEuint64 encAmountHandle,
        externalEuint256 noteHandle,
        bytes calldata inputProof
    ) external payable nonReentrant {
        if (!identityRegistry.isRegistered(msg.sender))
            revert SenderNotRegistered();
        if (!identityRegistry.isRegistered(recipient))
            revert RecipientNotRegistered();
        if (msg.value == 0) revert InsufficientETH();

        euint64 encAmount = FHE.fromExternal(encAmountHandle, inputProof);
        FHE.allowThis(encAmount);
        FHE.allow(encAmount, msg.sender);
        FHE.allow(encAmount, recipient);

        euint256 note = FHE.fromExternal(noteHandle, inputProof);
        FHE.allowThis(note);
        FHE.allow(note, msg.sender);
        FHE.allow(note, recipient);

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 netVal = msg.value - fee;

        if (fee > 0) {
            (bool feeOk, ) = protocolFeeRecipient.call{value: fee}("");
            require(feeOk, "fee transfer failed");
        }

        (bool ok, ) = recipient.call{value: netVal}("");
        require(ok, "ETH transfer failed");

        messageStore.sendSystemMessage(
            msg.sender,
            recipient,
            keccak256(abi.encodePacked("ETH_CONFIDENTIAL", block.timestamp)),
            1
        );

        emit PaymentSent(
            msg.sender,
            recipient,
            address(0),
            msg.value,
            block.timestamp
        );
    }

    // ──────────────────────────────────────────────────────────────────
    //  /send ERC20
    // ──────────────────────────────────────────────────────────────────

    function sendERC20(
        address recipient,
        address token,
        uint256 amount,
        externalEuint256 noteHandle,
        bytes calldata inputProof
    ) external nonReentrant {
        if (!identityRegistry.isRegistered(msg.sender))
            revert SenderNotRegistered();
        if (!identityRegistry.isRegistered(recipient))
            revert RecipientNotRegistered();

        euint256 note = FHE.fromExternal(noteHandle, inputProof);
        FHE.allowThis(note);
        FHE.allow(note, msg.sender);
        FHE.allow(note, recipient);

        uint256 fee = (amount * feeBps) / 10_000;
        uint256 netAmt = amount - fee;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        if (fee > 0) IERC20(token).safeTransfer(protocolFeeRecipient, fee);
        IERC20(token).safeTransfer(recipient, netAmt);

        messageStore.sendSystemMessage(
            msg.sender,
            recipient,
            keccak256(
                abi.encodePacked("ERC20", token, amount, block.timestamp)
            ),
            1
        );

        emit PaymentSent(msg.sender, recipient, token, amount, block.timestamp);
    }

    // ──────────────────────────────────────────────────────────────────
    //  /request payment
    // ──────────────────────────────────────────────────────────────────

    function createRequest(
        address payer,
        address token,
        uint256 amount,
        externalEuint64 encAmountHandle,
        externalEuint256 noteHandle,
        bytes calldata inputProof
    ) external nonReentrant {
        if (!identityRegistry.isRegistered(msg.sender))
            revert SenderNotRegistered();
        if (!identityRegistry.isRegistered(payer))
            revert RecipientNotRegistered();

        euint64 encAmount = FHE.fromExternal(encAmountHandle, inputProof);
        euint256 note = FHE.fromExternal(noteHandle, inputProof);

        FHE.allowThis(encAmount);
        FHE.allow(encAmount, msg.sender);
        FHE.allow(encAmount, payer);
        FHE.allowThis(note);
        FHE.allow(note, msg.sender);
        FHE.allow(note, payer);

        nextRequestId++;
        uint256 rid = nextRequestId;

        paymentRequests[rid] = PaymentRequest({
            requester: msg.sender,
            payer: payer,
            token: token,
            amount: amount,
            encryptedAmount: encAmount,
            encryptedNote: note,
            fulfilled: false,
            createdAt: block.timestamp
        });

        messageStore.sendSystemMessage(
            msg.sender,
            payer,
            keccak256(abi.encodePacked("REQUEST", rid, block.timestamp)),
            1
        );

        emit RequestCreated(rid, msg.sender, payer, token);
    }

    function fulfillRequest(uint256 requestId) external payable nonReentrant {
        PaymentRequest storage req = paymentRequests[requestId];
        if (req.requester == address(0)) revert RequestNotFound();
        if (req.fulfilled) revert RequestAlreadyFulfilled();
        if (msg.sender != req.payer) revert NotPayer();

        req.fulfilled = true;

        if (req.token == address(0)) {
            // ETH fulfillment
            if (msg.value < req.amount) revert InsufficientETH();
            (bool ok, ) = req.requester.call{value: req.amount}("");
            require(ok, "ETH transfer failed");
            // Refund overpayment
            if (msg.value > req.amount) {
                (bool refOk, ) = msg.sender.call{value: msg.value - req.amount}(
                    ""
                );
                require(refOk, "refund failed");
            }
        } else {
            IERC20(req.token).safeTransferFrom(
                msg.sender,
                req.requester,
                req.amount
            );
        }

        messageStore.sendSystemMessage(
            req.payer,
            req.requester,
            keccak256(
                abi.encodePacked("FULFILLED", requestId, block.timestamp)
            ),
            1
        );

        emit RequestFulfilled(requestId);
    }

    function fulfillRequestConfidential(
        uint256 requestId,
        externalEuint64 encAmountHandle,
        externalEuint256 noteHandle,
        bytes calldata inputProof
    ) external payable nonReentrant {
        PaymentRequest storage req = paymentRequests[requestId];
        if (req.requester == address(0)) revert RequestNotFound();
        if (req.fulfilled) revert RequestAlreadyFulfilled();
        if (msg.sender != req.payer) revert NotPayer();

        req.fulfilled = true;

        // Fresh fulfillment proof generated by payer at payment time.
        // Stored with ACL grants so requester and payer can decrypt fulfillment metadata.
        euint64 encAmount = FHE.fromExternal(encAmountHandle, inputProof);
        FHE.allowThis(encAmount);
        FHE.allow(encAmount, req.payer);
        FHE.allow(encAmount, req.requester);

        euint256 note = FHE.fromExternal(noteHandle, inputProof);
        FHE.allowThis(note);
        FHE.allow(note, req.payer);
        FHE.allow(note, req.requester);

        if (req.token == address(0)) {
            if (msg.value < req.amount) revert InsufficientETH();
            (bool ok, ) = req.requester.call{value: req.amount}("");
            require(ok, "ETH transfer failed");
            if (msg.value > req.amount) {
                (bool refOk, ) = msg.sender.call{value: msg.value - req.amount}(
                    ""
                );
                require(refOk, "refund failed");
            }
        } else {
            IERC20(req.token).safeTransferFrom(
                msg.sender,
                req.requester,
                req.amount
            );
        }

        messageStore.sendSystemMessage(
            req.payer,
            req.requester,
            keccak256(
                abi.encodePacked(
                    "FULFILLED_CONFIDENTIAL",
                    requestId,
                    block.timestamp
                )
            ),
            1
        );

        emit RequestFulfilled(requestId);
    }

    // ──────────────────────────────────────────────────────────────────
    //  /escrow
    // ──────────────────────────────────────────────────────────────────

    function createEscrow(
        address beneficiary,
        address arbitrator,
        address token,
        uint256 amount,
        externalEuint256 termsHandle,
        bytes calldata inputProof
    ) external payable nonReentrant {
        if (!identityRegistry.isRegistered(msg.sender))
            revert SenderNotRegistered();
        if (!identityRegistry.isRegistered(beneficiary))
            revert RecipientNotRegistered();
        if (!identityRegistry.isRegistered(arbitrator))
            revert ArbitratorNotRegistered();

        euint256 terms = FHE.fromExternal(termsHandle, inputProof);
        FHE.allowThis(terms);
        FHE.allow(terms, msg.sender);
        FHE.allow(terms, beneficiary);
        FHE.allow(terms, arbitrator);

        nextEscrowId++;
        uint256 eid = nextEscrowId;

        escrows[eid] = Escrow({
            depositor: msg.sender,
            beneficiary: beneficiary,
            arbitrator: arbitrator,
            token: token,
            amount: amount,
            encryptedTerms: terms,
            depositorApproved: false, // FIX: plaintext bool — no sync decrypt
            beneficiaryApproved: false, // FIX: plaintext bool
            released: false,
            refunded: false,
            createdAt: block.timestamp
        });

        // Hold funds in contract
        if (token == address(0)) {
            if (msg.value < amount) revert InsufficientETH();
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        messageStore.sendSystemMessage(
            msg.sender,
            beneficiary,
            keccak256(abi.encodePacked("ESCROW_CREATED", eid, block.timestamp)),
            1
        );

        emit EscrowCreated(eid, msg.sender, beneficiary, arbitrator);
    }

    /**
     * @notice Either party approves the escrow release.
     *         When both have approved, funds are released to beneficiary.
     *
     * FIX: Uses plaintext bool flags — no synchronous FHE.decrypt() needed.
     *      Escrow approval is an explicit on-chain intent — no need to hide it.
     */
    function approveEscrowRelease(uint256 escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.depositor == address(0)) revert EscrowNotFound();
        if (e.released || e.refunded) revert EscrowAlreadySettled();
        if (
            msg.sender != e.depositor &&
            msg.sender != e.beneficiary &&
            msg.sender != e.arbitrator
        ) revert NotEscrowParty();

        // Mark approval
        if (msg.sender == e.depositor || msg.sender == e.arbitrator) {
            e.depositorApproved = true;
        }
        if (msg.sender == e.beneficiary || msg.sender == e.arbitrator) {
            e.beneficiaryApproved = true;
        }

        emit EscrowApproved(escrowId, msg.sender);

        // Release if both sides approved
        if (e.depositorApproved && e.beneficiaryApproved) {
            e.released = true;
            _transferFunds(e.token, e.beneficiary, e.amount);
            messageStore.sendSystemMessage(
                e.depositor,
                e.beneficiary,
                keccak256(
                    abi.encodePacked(
                        "ESCROW_RELEASED",
                        escrowId,
                        block.timestamp
                    )
                ),
                1
            );
            emit EscrowReleased(escrowId);
        }
    }

    function refundEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.depositor == address(0)) revert EscrowNotFound();
        if (e.released || e.refunded) revert EscrowAlreadySettled();
        // Only arbitrator can force-refund; depositor may self-refund if beneficiary hasn't approved yet
        require(
            msg.sender == e.arbitrator ||
                (msg.sender == e.depositor && !e.beneficiaryApproved),
            "unauthorized refund"
        );

        e.refunded = true;
        _transferFunds(e.token, e.depositor, e.amount);

        emit EscrowRefunded(escrowId);
    }

    // ──────────────────────────────────────────────────────────────────
    //  /split
    // ──────────────────────────────────────────────────────────────────

    function createSplit(
        address[] calldata participants,
        address token,
        uint256 totalAmount,
        externalEuint256 noteHandle,
        bytes calldata inputProof
    ) external nonReentrant {
        if (!identityRegistry.isRegistered(msg.sender))
            revert SenderNotRegistered();
        if (participants.length > MAX_SPLIT_PARTICIPANTS)
            revert TooManyParticipants();

        euint256 note = FHE.fromExternal(noteHandle, inputProof);
        FHE.allowThis(note);
        FHE.allow(note, msg.sender);
        for (uint256 i = 0; i < participants.length; i++) {
            FHE.allow(note, participants[i]);
        }

        nextSplitId++;
        uint256 sid = nextSplitId;

        SplitPayment storage sp = splits[sid];
        sp.initiator = msg.sender;
        sp.participants = participants;
        sp.token = token;
        sp.totalAmount = totalAmount;
        sp.perParticipant = totalAmount / participants.length;
        sp.encryptedNote = note;
        sp.settled = false;
        sp.createdAt = block.timestamp;

        emit SplitCreated(sid, msg.sender, token, totalAmount);
    }

    function contributeToSplit(uint256 splitId) external payable nonReentrant {
        SplitPayment storage sp = splits[splitId];
        if (sp.initiator == address(0)) revert SplitNotFound();
        if (sp.settled) revert SplitAlreadySettled();

        bool found = false;
        for (uint256 i = 0; i < sp.participants.length; i++) {
            if (sp.participants[i] == msg.sender) {
                found = true;
                break;
            }
        }
        if (!found) revert NotSplitParticipant();
        if (sp.paid[msg.sender]) revert AlreadyPaid();

        sp.paid[msg.sender] = true;

        if (sp.token == address(0)) {
            require(msg.value >= sp.perParticipant, "insufficient ETH");
        } else {
            IERC20(sp.token).safeTransferFrom(
                msg.sender,
                address(this),
                sp.perParticipant
            );
        }

        emit SplitContributed(splitId, msg.sender);

        // Check if all participants paid
        bool allPaid = true;
        for (uint256 i = 0; i < sp.participants.length; i++) {
            if (!sp.paid[sp.participants[i]]) {
                allPaid = false;
                break;
            }
        }

        if (allPaid) {
            sp.settled = true;
            // Transfer collected funds to initiator
            _transferFunds(sp.token, sp.initiator, sp.totalAmount);
            emit SplitSettled(splitId);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ──────────────────────────────────────────────────────────────────

    function _transferFunds(
        address token,
        address to,
        uint256 amount
    ) internal {
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    receive() external payable {}
}

// ──────────────────────────────────────────────────────────────────
//  Interfaces
// ──────────────────────────────────────────────────────────────────

interface IIdentityRegistry {
    function isRegistered(address user) external view returns (bool);
}

interface IMessageStore {
    function sendSystemMessage(
        address sender,
        address recipient,
        bytes32 referenceHash,
        uint8 msgType
    ) external;
}
