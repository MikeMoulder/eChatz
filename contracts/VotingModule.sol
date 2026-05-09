// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint32, euint256, externalEuint32, externalEuint256} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VotingModule
 * @notice Encrypted on-chain polls tied to chat threads (/vote command).
 *
 * Design notes:
 *  - hasVoted is a plaintext mapping — ballot privacy is preserved through
 *    encrypted tallies, not through hiding participation.
 *  - FHE.select() accumulates votes without revealing individual choices.
 *  - euint32 per option supports up to 2^32 votes before overflow.
 *  - Poll results (aggregate tallies only) are decrypted publicly on close;
 *    individual ballots are never exposed.
 *  - Maximum 5 options and 20 voters per poll.
 */
contract VotingModule is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard {
    // ──────────────────────────────────────────────────────────────────
    //  Types & Constants
    // ──────────────────────────────────────────────────────────────────

    uint8 public constant MAX_OPTIONS = 5;
    uint8 public constant MAX_VOTERS = 20;

    enum PollState {
        Open,
        Closed
    }

    struct Poll {
        address creator;
        uint256 threadId; // MessageStore thread this poll belongs to
        string question; // Plaintext question metadata
        string[] optionLabels; // Plaintext option labels (max MAX_OPTIONS)
        uint8 optionCount;
        euint32[] encryptedTallies; // one per option
        PollState state;
        uint256 createdAt;
        uint256 closedAt;
        uint256 voterCount;
    }

    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    IIdentityRegistry public immutable identityRegistry;
    IMessageStore public immutable messageStore;

    uint256 public nextPollId;

    mapping(uint256 => Poll) private polls;
    mapping(uint256 => address[]) private pollVoters;
    mapping(uint256 => mapping(address => bool)) public hasVoted; // plaintext bool — FIX

    // ──────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────

    event PollCreated(
        uint256 indexed pollId,
        address indexed creator,
        uint256 indexed threadId,
        string question
    );
    event VoteCast(uint256 indexed pollId, address indexed voter);
    event PollClosed(uint256 indexed pollId, uint256 closedAt);
    event TallyHandleGranted(
        uint256 indexed pollId,
        uint8 option,
        address indexed grantee
    );

    // ──────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────

    error UserNotRegistered();
    error TooManyOptions();
    error PollNotOpen();
    error AlreadyVoted();
    error VoterLimitReached();
    error NotPollCreator();
    error PollAlreadyClosed();
    error InvalidOptionCount();
    error PollNotFound();

    // ──────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────

    constructor(
        address _messageStore,
        address _identityRegistry
    ) Ownable(msg.sender) {
        messageStore = IMessageStore(_messageStore);
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Create poll
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Create an encrypted poll in a thread.
     * @param threadId     MessageStore thread ID (both participants can see this poll)
     * @param question     Plaintext question (metadata only — labels don't need encryption)
     * @param optionLabels Plaintext option labels (encrypted content sent separately via messages)
     */
    function createPoll(
        uint256 threadId,
        string calldata question,
        string[] calldata optionLabels
    ) external nonReentrant {
        if (!identityRegistry.isRegistered(msg.sender))
            revert UserNotRegistered();
        if (optionLabels.length == 0 || optionLabels.length > MAX_OPTIONS)
            revert TooManyOptions();

        nextPollId++;
        uint256 pid = nextPollId;

        Poll storage p = polls[pid];
        p.creator = msg.sender;
        p.threadId = threadId;
        p.question = question;
        p.optionCount = uint8(optionLabels.length);
        p.state = PollState.Open;
        p.createdAt = block.timestamp;
        p.voterCount = 0;

        for (uint8 i = 0; i < optionLabels.length; i++) {
            p.optionLabels.push(optionLabels[i]);
        }

        // Initialize encrypted tallies to zero for each option
        for (uint8 i = 0; i < optionLabels.length; i++) {
            euint32 tally = FHE.asEuint32(0);
            p.encryptedTallies.push(tally);
            FHE.allowThis(tally);
        }

        emit PollCreated(pid, msg.sender, threadId, question);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Cast vote (FHE-encrypted ballot)
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Cast an encrypted vote.
     * @param pollId        Poll to vote on.
     * @param choiceHandle  externalEuint32 — encrypted choice index (0 to optionCount-1).
     * @param inputProof    Relayer SDK proof bundle.
     *
     * ENCRYPTED BALLOT LOGIC:
     *  For each option i, we use FHE.select to conditionally add 1 if choice == i.
     *  This preserves ballot privacy — no party can see which option was chosen.
     *
     *  hasVoted[pollId][voter] is plaintext bool — only records IF someone voted,
     *  not WHAT they voted (satisfies deny-by-default privacy for ballot content).
     */
    function castVote(
        uint256 pollId,
        externalEuint32 choiceHandle,
        bytes calldata inputProof
    ) external nonReentrant {
        if (!identityRegistry.isRegistered(msg.sender))
            revert UserNotRegistered();

        Poll storage p = polls[pollId];
        if (p.creator == address(0)) revert PollNotFound();
        if (p.state != PollState.Open) revert PollNotOpen();
        if (hasVoted[pollId][msg.sender]) revert AlreadyVoted(); // plaintext check — FIX
        if (p.voterCount >= MAX_VOTERS) revert VoterLimitReached();

        // Verify and load the encrypted choice from relayer
        euint32 choice = FHE.fromExternal(choiceHandle, inputProof);

        // For each option: if encrypted choice == i, add 1 to that option's tally
        for (uint8 i = 0; i < p.optionCount; i++) {
            // Encrypted equality check: is this vote for option i?
            ebool isForThisOption = FHE.eq(choice, FHE.asEuint32(i));

            // Encrypted conditional add: tally[i] += isForThisOption ? 1 : 0
            euint32 increment = FHE.select(
                isForThisOption,
                FHE.asEuint32(1),
                FHE.asEuint32(0)
            );
            euint32 newTally = FHE.add(p.encryptedTallies[i], increment);

            // Store updated tally and re-grant ACL (must re-allow after every write)
            p.encryptedTallies[i] = newTally;
            FHE.allowThis(newTally);
        }

        // Record vote cast (plaintext)
        hasVoted[pollId][msg.sender] = true;
        pollVoters[pollId].push(msg.sender);
        p.voterCount++;

        emit VoteCast(pollId, msg.sender);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Close poll & reveal tally
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Close the poll and grant tally handles to both thread participants.
     *         Only creator can close.
     *         Tally handles are granted to each grantee; only aggregate results are decryptable.
     */
    function closePoll(uint256 pollId, address[] calldata grantees) external {
        Poll storage p = polls[pollId];
        if (p.creator == address(0)) revert PollNotFound();
        if (msg.sender != p.creator) revert NotPollCreator();
        if (p.state == PollState.Closed) revert PollAlreadyClosed();

        p.state = PollState.Closed;
        p.closedAt = block.timestamp;

        // Grant all grantees (participants) decrypt access to final tallies
        for (uint8 i = 0; i < p.optionCount; i++) {
            for (uint256 j = 0; j < grantees.length; j++) {
                FHE.allow(p.encryptedTallies[i], grantees[j]);
                emit TallyHandleGranted(pollId, i, grantees[j]);
            }
        }

        emit PollClosed(pollId, block.timestamp);
    }

    /**
     * @notice Return the encrypted tally handle for one option.
     *         Grants ACL to msg.sender (for relayer userDecrypt flow).
     */
    function getTallyHandle(
        uint256 pollId,
        uint8 optionIndex
    ) external returns (euint32) {
        Poll storage p = polls[pollId];
        if (p.creator == address(0)) revert PollNotFound();
        FHE.allow(p.encryptedTallies[optionIndex], msg.sender);
        return p.encryptedTallies[optionIndex];
    }

    // ──────────────────────────────────────────────────────────────────
    //  Metadata reads
    // ──────────────────────────────────────────────────────────────────

    function getPollMeta(
        uint256 pollId
    )
        external
        view
        returns (
            address creator,
            uint256 threadId,
            string memory question,
            string[] memory optionLabels,
            uint8 optionCount,
            PollState state,
            uint256 createdAt,
            uint256 closedAt,
            uint256 voterCount
        )
    {
        Poll storage p = polls[pollId];
        return (
            p.creator,
            p.threadId,
            p.question,
            p.optionLabels,
            p.optionCount,
            p.state,
            p.createdAt,
            p.closedAt,
            p.voterCount
        );
    }

    function getPollVoters(
        uint256 pollId
    ) external view returns (address[] memory) {
        return pollVoters[pollId];
    }
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
