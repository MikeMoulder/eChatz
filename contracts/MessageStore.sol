// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint256, externalEbool, externalEuint256} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MessageStore
 * @notice On-chain encrypted P2P messaging.
 *
 * CORRECTIONS FROM SPEC:
 *  - Single ciphertext per message (NOT dual ciphertext) — fhEVM uses a global KMS key.
 *    Both sender and recipient are ACL-granted on the same handle.
 *  - euint256 stores up to 32 inline bytes or a 32-byte encrypted IPFS CID pointer.
 *  - FHE.* namespace (not TFHE.*)
 *  - No synchronous decrypt in contract body
 *  - FHE.allowThis + FHE.allow after every encrypted write
 *  - pragma ^0.8.27, SepoliaConfig inheritance
 *  - CONSTRAINT_7 / FIX_1: REQUIRE(isRegistered) for sender AND recipient at sendMessage()
 *  - CONSTRAINT_6: isBlocked check before storing message
 */
contract MessageStore is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard {
    // ──────────────────────────────────────────────────────────────────
    //  Types & Constants
    // ──────────────────────────────────────────────────────────────────

    uint8 public constant STORAGE_ONCHAIN = 0;
    uint8 public constant STORAGE_IPFS = 1;

    uint8 public constant MSG_TEXT = 0;
    uint8 public constant MSG_PAYMENT = 1; // system msg from PaymentRouter
    uint8 public constant MSG_VOTE = 2; // system msg from VotingModule

    struct Message {
        address sender;
        address recipient;
        uint256 timestamp;
        uint8 messageType;
        uint8 storageType;
        euint256 encryptedContent; // on-chain payload OR encrypted IPFS CID pointer
        ebool isRead;
        ebool isBurned;
        uint256 threadId;
    }

    struct Thread {
        address[2] participants;
        uint256 messageCount;
        uint256 lastActivity;
    }

    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    IIdentityRegistry public immutable identityRegistry;

    uint256 public nextMessageId;
    uint256 public nextThreadId;

    mapping(uint256 => Message) private messages;
    mapping(uint256 => Thread) public threads;

    /// @dev Canonical thread between two addresses (order-independent)
    mapping(bytes32 => uint256) private threadIds;

    mapping(uint256 => uint256[]) private threadMessages; // threadId → messageIds

    // ──────────────────────────────────────────────────────────────────
    //  Trusted callers (PaymentRouter, VotingModule) for system messages
    // ──────────────────────────────────────────────────────────────────

    mapping(address => bool) public trustedCallers;

    // ──────────────────────────────────────────────────────────────────
    //  Events (metadata only — no content, no handles in logs)
    // ──────────────────────────────────────────────────────────────────

    event MessageSent(
        uint256 indexed messageId,
        uint256 indexed threadId,
        address indexed sender,
        address recipient,
        uint8 messageType,
        uint8 storageType,
        uint256 timestamp
    );
    event MessageRead(uint256 indexed messageId, address indexed reader);
    event MessageBurned(uint256 indexed messageId);
    event TrustedCallerSet(address indexed caller, bool enabled);

    // ──────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────

    error SenderNotRegistered();
    error RecipientNotRegistered();
    error RecipientBlocked();
    error MessageBurnedError();
    error NotParticipant();
    error NotTrustedCaller();
    error InvalidStorageType();

    // ──────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────

    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────────────────────────

    function setTrustedCaller(address caller, bool enabled) external onlyOwner {
        trustedCallers[caller] = enabled;
        emit TrustedCallerSet(caller, enabled);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Send message
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Send an encrypted message from msg.sender to `recipient`.
     * @param recipient     Registered eChatz user address.
     * @param contentHandle externalEuint256 handle — on-chain payload OR encrypted IPFS CID.
     * @param inputProof    Proof bundle from relayer SDK.
     * @param msgType       MSG_TEXT (0) | MSG_PAYMENT (1) | MSG_VOTE (2)
     * @param storType      STORAGE_ONCHAIN (0) | STORAGE_IPFS (1)
     *
     * SINGLE CIPHERTEXT MODEL:
     *  The global fhEVM KMS encrypts under one key.
     *  We store ONE encrypted handle and call FHE.allow() for both sender and recipient.
     *  Both parties can decrypt via the relayer userDecrypt() flow.
     */
    function sendMessage(
        address recipient,
        externalEuint256 contentHandle,
        bytes calldata inputProof,
        uint8 msgType,
        uint8 storType
    ) external nonReentrant {
        // Resolve session key → owner so msg.sender can be a gas wallet
        address realSender = identityRegistry.resolveUser(msg.sender);

        // FIX_1 / FIX_2: Registration gate (both layers)
        if (!identityRegistry.isRegistered(realSender))
            revert SenderNotRegistered();
        if (!identityRegistry.isRegistered(recipient))
            revert RecipientNotRegistered();

        // Blocklist check: if recipient has blocked realSender, revert
        if (identityRegistry.isBlocked(recipient, realSender))
            revert RecipientBlocked();

        if (storType != STORAGE_ONCHAIN && storType != STORAGE_IPFS)
            revert InvalidStorageType();

        // Verify and load the encrypted input from the relayer
        // inputProof was generated for msg.sender (session key) — correct
        euint256 content = FHE.fromExternal(contentHandle, inputProof);

        // ACL: grant contract storage right + both parties decrypt right
        // Decrypt ACL is on the real owner, not the session key
        FHE.allowThis(content);
        FHE.allow(content, realSender);
        FHE.allow(content, recipient);

        // Encrypted read/burn flags
        ebool isRead = FHE.asEbool(false);
        ebool isBurned = FHE.asEbool(false);
        FHE.allowThis(isRead);
        FHE.allow(isRead, realSender);
        FHE.allow(isRead, recipient);
        FHE.allowThis(isBurned);
        FHE.allow(isBurned, realSender);
        FHE.allow(isBurned, recipient);

        // Get or create thread (keyed on real addresses)
        uint256 tid = _getOrCreateThread(realSender, recipient);

        // Assign IDs
        nextMessageId++;
        uint256 mid = nextMessageId;

        // Store realSender — the session key address is never persisted on-chain
        messages[mid] = Message({
            sender: realSender,
            recipient: recipient,
            timestamp: block.timestamp,
            messageType: msgType,
            storageType: storType,
            encryptedContent: content,
            isRead: isRead,
            isBurned: isBurned,
            threadId: tid
        });

        threadMessages[tid].push(mid);

        // Update thread metadata
        Thread storage t = threads[tid];
        t.messageCount++;
        t.lastActivity = block.timestamp;

        emit MessageSent(
            mid,
            tid,
            realSender,
            recipient,
            msgType,
            storType,
            block.timestamp
        );
    }

    /**
     * @notice Trusted callers (PaymentRouter, VotingModule) write system messages.
     *         Content is a plaintext ABI-encoded bytes32 tag (e.g. a reference hash).
     *         NOT encrypted — system messages carry only reference metadata.
     */
    function sendSystemMessage(
        address sender,
        address recipient,
        bytes32 referenceHash,
        uint8 msgType
    ) external {
        if (!trustedCallers[msg.sender]) revert NotTrustedCaller();
        if (!identityRegistry.isRegistered(sender))
            revert SenderNotRegistered();
        if (!identityRegistry.isRegistered(recipient))
            revert RecipientNotRegistered();

        uint256 tid = _getOrCreateThread(sender, recipient);
        nextMessageId++;
        uint256 mid = nextMessageId;

        // System message content = encrypted reference hash (content is in referenceHash)
        euint256 empty = FHE.asEuint256(uint256(referenceHash));
        FHE.allowThis(empty);
        FHE.allow(empty, sender);
        FHE.allow(empty, recipient);

        ebool isRead = FHE.asEbool(false);
        ebool isBurned = FHE.asEbool(false);
        FHE.allowThis(isRead);
        FHE.allow(isRead, sender);
        FHE.allow(isRead, recipient);
        FHE.allowThis(isBurned);
        FHE.allow(isBurned, sender);
        FHE.allow(isBurned, recipient);

        messages[mid] = Message({
            sender: sender,
            recipient: recipient,
            timestamp: block.timestamp,
            messageType: msgType,
            storageType: STORAGE_ONCHAIN,
            encryptedContent: empty,
            isRead: isRead,
            isBurned: isBurned,
            threadId: tid
        });

        threadMessages[tid].push(mid);
        Thread storage t = threads[tid];
        t.messageCount++;
        t.lastActivity = block.timestamp;

        emit MessageSent(
            mid,
            tid,
            sender,
            recipient,
            msgType,
            STORAGE_ONCHAIN,
            block.timestamp
        );
    }

    // ──────────────────────────────────────────────────────────────────
    //  Read message content handle
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Return the encrypted content handle for a message.
     *         Grants ACL to msg.sender — only participants are allowed.
     */
    function getMessageContent(uint256 messageId) external returns (euint256) {
        Message storage m = messages[messageId];
        address caller = identityRegistry.resolveUser(msg.sender);
        if (caller != m.sender && caller != m.recipient)
            revert NotParticipant();
        FHE.allow(m.encryptedContent, caller);
        return m.encryptedContent;
    }

    /**
     * @notice Get message metadata (no encrypted content).
     */
    function getMessageMeta(
        uint256 messageId
    )
        external
        view
        returns (
            address sender,
            address recipient,
            uint256 timestamp,
            uint8 messageType,
            uint8 storageType,
            uint256 threadId
        )
    {
        Message storage m = messages[messageId];
        address caller = identityRegistry.resolveUser(msg.sender);
        if (caller != m.sender && caller != m.recipient)
            revert NotParticipant();
        return (
            m.sender,
            m.recipient,
            m.timestamp,
            m.messageType,
            m.storageType,
            m.threadId
        );
    }

    // ──────────────────────────────────────────────────────────────────
    //  Mark read
    // ──────────────────────────────────────────────────────────────────

    function markRead(uint256 messageId) external {
        Message storage m = messages[messageId];
        address caller = identityRegistry.resolveUser(msg.sender);
        if (caller != m.recipient && caller != m.sender)
            revert NotParticipant();

        ebool read = FHE.asEbool(true);
        m.isRead = read;
        FHE.allowThis(read);
        FHE.allow(read, m.sender);
        FHE.allow(read, m.recipient);

        emit MessageRead(messageId, msg.sender);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Burn after read
    //
    //  CONSTRAINT_5: Blockchain state is immutable.
    //  We overwrite the ciphertext slot with an encrypted zero-value.
    //  The on-chain handle is replaced — old ciphertext is inaccessible via ACL.
    // ──────────────────────────────────────────────────────────────────

    function burnMessage(uint256 messageId) external {
        Message storage m = messages[messageId];
        address caller = identityRegistry.resolveUser(msg.sender);
        if (caller != m.sender && caller != m.recipient)
            revert NotParticipant();

        // Overwrite content with encrypted zero — practical inaccessibility
        euint256 zero = FHE.asEuint256(0);
        m.encryptedContent = zero;
        FHE.allowThis(zero);
        // No ACL grants to anyone — new zero handle is inaccessible

        ebool burned = FHE.asEbool(true);
        m.isBurned = burned;
        FHE.allowThis(burned);
        FHE.allow(burned, m.sender);
        FHE.allow(burned, m.recipient);

        emit MessageBurned(messageId);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Thread queries
    // ──────────────────────────────────────────────────────────────────

    function getThreadMessageIds(
        uint256 threadId,
        uint256 skip,
        uint256 first
    ) external view returns (uint256[] memory) {
        uint256[] storage all = threadMessages[threadId];
        uint256 total = all.length;
        if (skip >= total) return new uint256[](0);
        uint256 end = skip + first > total ? total : skip + first;
        uint256[] memory page = new uint256[](end - skip);
        for (uint256 i = skip; i < end; i++) {
            page[i - skip] = all[i];
        }
        return page;
    }

    function getThreadId(address a, address b) external view returns (uint256) {
        return threadIds[_threadKey(a, b)];
    }

    // ──────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ──────────────────────────────────────────────────────────────────

    function _getOrCreateThread(
        address a,
        address b
    ) internal returns (uint256) {
        bytes32 key = _threadKey(a, b);
        uint256 tid = threadIds[key];
        if (tid == 0) {
            nextThreadId++;
            tid = nextThreadId;
            threadIds[key] = tid;
            threads[tid] = Thread({
                participants: [a, b],
                messageCount: 0,
                lastActivity: block.timestamp
            });
        }
        return tid;
    }

    function _threadKey(address a, address b) internal pure returns (bytes32) {
        // Canonical order: smaller address first
        (address lo, address hi) = a < b ? (a, b) : (b, a);
        return keccak256(abi.encodePacked(lo, hi));
    }
}

// ──────────────────────────────────────────────────────────────────
//  Interface: IdentityRegistry (minimal surface used here)
// ──────────────────────────────────────────────────────────────────

interface IIdentityRegistry {
    function isRegistered(address user) external view returns (bool);

    function isBlocked(
        address owner,
        address target
    ) external view returns (bool);

    /// @notice Resolve a session key to its owner; returns addr unchanged if not a session key.
    function resolveUser(address addr) external view returns (address);
}
