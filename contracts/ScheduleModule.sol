// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, euint256, externalEuint64, externalEuint256} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ScheduleModule
 * @notice Automated recurring payments (/schedule command).
 *         Uses Gelato Network or Chainlink Automation as off-chain executor.
 *
 * On-chain state: scheduled payment config + last execution timestamp.
 * Off-chain automation: Gelato/Chainlink calls executeScheduled() on each interval.
 *
 * CORRECTIONS FROM SPEC:
 *  - euint64 for encrypted amount (not arbitrary euint)
 *  - euint256 for encrypted note
 *  - FHE.* API (not TFHE.*)
 *  - FHE.allowThis + FHE.allow after every encrypted write
 *  - pragma ^0.8.27, SepoliaConfig inheritance
 *  - No synchronous decrypt in contract body
 */
contract ScheduleModule is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────────────────────────
    //  Types & Constants
    // ──────────────────────────────────────────────────────────────────

    uint256 public constant MIN_INTERVAL_SECONDS = 3600; // 1 hour minimum
    uint256 public constant MAX_EXECUTIONS = 365; // 1 year daily cap

    struct ScheduledPayment {
        address owner;
        address recipient;
        address token; // address(0) = ETH
        uint256 amount; // plaintext amount
        euint64 encryptedAmount; // FHE-encrypted version
        euint256 encryptedNote;
        uint256 intervalSeconds;
        uint256 maxExecutions;
        uint256 executionCount;
        uint256 startAt;
        uint256 lastExecutedAt;
        bool paused;
        bool cancelled;
    }

    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    IPaymentRouter public immutable paymentRouter;
    IIdentityRegistry public immutable identityRegistry;

    /// @dev Automation executor address (Gelato relay or Chainlink upkeep forwarder)
    address public automationExecutor;

    uint256 public nextScheduleId;

    mapping(uint256 => ScheduledPayment) public scheduledPayments;
    mapping(address => uint256[]) private ownerSchedules;

    // ──────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────

    event ScheduleCreated(
        uint256 indexed scheduleId,
        address indexed owner,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 intervalSeconds
    );
    event ScheduleExecuted(
        uint256 indexed scheduleId,
        uint256 executionCount,
        uint256 executedAt
    );
    event SchedulePaused(uint256 indexed scheduleId);
    event ScheduleResumed(uint256 indexed scheduleId);
    event ScheduleCancelled(uint256 indexed scheduleId);
    event AutomationExecutorUpdated(address indexed executor);

    // ──────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────

    error OwnerNotRegistered();
    error RecipientNotRegistered();
    error IntervalTooShort();
    error MaxExecutionsTooHigh();
    error ScheduleNotFound();
    error NotScheduleOwner();
    error ScheduleCancelledError();
    error ScheduleNotDue();
    error MaxExecutionsReached();
    error SchedulePausedError();
    error NotAutomationExecutor();
    error InsufficientFunds();

    // ──────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────

    constructor(
        address _paymentRouter,
        address _identityRegistry,
        address _automationExecutor
    ) Ownable(msg.sender) {
        paymentRouter = IPaymentRouter(_paymentRouter);
        identityRegistry = IIdentityRegistry(_identityRegistry);
        automationExecutor = _automationExecutor;
    }

    // ──────────────────────────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────────────────────────

    function setAutomationExecutor(address executor) external onlyOwner {
        automationExecutor = executor;
        emit AutomationExecutorUpdated(executor);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Schedule creation
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Create a recurring payment schedule.
     * @param recipient         Beneficiary address.
     * @param token             ERC20 token or address(0) for ETH.
     * @param amount            Plaintext transfer amount per execution.
     * @param amountHandle      externalEuint64 — encrypted amount.
     * @param noteHandle        externalEuint256 — encrypted note.
     * @param inputProof        Relayer SDK proof bundle.
     * @param intervalSeconds   Seconds between executions (minimum 1 hour).
     * @param maxExecutions     Cap on number of automatic executions (max 365).
     * @param startAt           Earliest timestamp for first execution (0 = now).
     */
    function schedulePayment(
        address recipient,
        address token,
        uint256 amount,
        externalEuint64 amountHandle,
        externalEuint256 noteHandle,
        bytes calldata inputProof,
        uint256 intervalSeconds,
        uint256 maxExecutions,
        uint256 startAt
    ) external payable nonReentrant {
        if (!identityRegistry.isRegistered(msg.sender))
            revert OwnerNotRegistered();
        if (!identityRegistry.isRegistered(recipient))
            revert RecipientNotRegistered();
        if (intervalSeconds < MIN_INTERVAL_SECONDS) revert IntervalTooShort();
        if (maxExecutions > MAX_EXECUTIONS) revert MaxExecutionsTooHigh();

        euint64 encAmount = FHE.fromExternal(amountHandle, inputProof);
        euint256 note = FHE.fromExternal(noteHandle, inputProof);

        FHE.allowThis(encAmount);
        FHE.allow(encAmount, msg.sender);
        FHE.allow(encAmount, recipient);
        FHE.allowThis(note);
        FHE.allow(note, msg.sender);
        FHE.allow(note, recipient);

        // Pre-fund ETH for scheduled payments
        if (token == address(0)) {
            require(
                msg.value >= amount * maxExecutions,
                "insufficient ETH pre-fund"
            );
        } else {
            // For ERC20, approve must be done by owner separately; pull on each execution
            require(msg.value == 0, "no ETH for token schedule");
        }

        nextScheduleId++;
        uint256 sid = nextScheduleId;

        scheduledPayments[sid] = ScheduledPayment({
            owner: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            encryptedAmount: encAmount,
            encryptedNote: note,
            intervalSeconds: intervalSeconds,
            maxExecutions: maxExecutions,
            executionCount: 0,
            startAt: startAt == 0 ? block.timestamp : startAt,
            lastExecutedAt: 0,
            paused: false,
            cancelled: false
        });

        ownerSchedules[msg.sender].push(sid);

        emit ScheduleCreated(
            sid,
            msg.sender,
            recipient,
            token,
            amount,
            intervalSeconds
        );
    }

    // ──────────────────────────────────────────────────────────────────
    //  Execution (called by Gelato / Chainlink Automation)
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Execute a scheduled payment. Called by the automation executor.
     * @param scheduleId  Schedule to execute.
     *
     * NOTE: Gelato or Chainlink Upkeep should call this when isDue() returns true.
     *       The automation service monitors isDue() off-chain and submits execution tx.
     */
    function executeScheduled(uint256 scheduleId) external nonReentrant {
        if (msg.sender != automationExecutor && msg.sender != owner())
            revert NotAutomationExecutor();

        ScheduledPayment storage sp = scheduledPayments[scheduleId];
        if (sp.owner == address(0)) revert ScheduleNotFound();
        if (sp.cancelled) revert ScheduleCancelledError();
        if (sp.paused) revert SchedulePausedError();
        if (sp.executionCount >= sp.maxExecutions)
            revert MaxExecutionsReached();

        uint256 nextDue = sp.lastExecutedAt == 0
            ? sp.startAt
            : sp.lastExecutedAt + sp.intervalSeconds;

        if (block.timestamp < nextDue) revert ScheduleNotDue();

        sp.executionCount++;
        sp.lastExecutedAt = block.timestamp;

        // Execute transfer
        if (sp.token == address(0)) {
            if (address(this).balance < sp.amount) revert InsufficientFunds();
            (bool ok, ) = sp.recipient.call{value: sp.amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20(sp.token).safeTransferFrom(
                sp.owner,
                sp.recipient,
                sp.amount
            );
        }

        emit ScheduleExecuted(scheduleId, sp.executionCount, block.timestamp);

        // Auto-cancel if max reached
        if (sp.executionCount >= sp.maxExecutions) {
            sp.cancelled = true;
            emit ScheduleCancelled(scheduleId);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  Upkeep check (Chainlink Automation compatible)
    // ──────────────────────────────────────────────────────────────────

    function isDue(uint256 scheduleId) external view returns (bool) {
        ScheduledPayment storage sp = scheduledPayments[scheduleId];
        if (sp.owner == address(0)) return false;
        if (sp.cancelled || sp.paused) return false;
        if (sp.executionCount >= sp.maxExecutions) return false;

        uint256 nextDue = sp.lastExecutedAt == 0
            ? sp.startAt
            : sp.lastExecutedAt + sp.intervalSeconds;

        return block.timestamp >= nextDue;
    }

    // ──────────────────────────────────────────────────────────────────
    //  Schedule management (owner only)
    // ──────────────────────────────────────────────────────────────────

    function pauseSchedule(uint256 scheduleId) external {
        ScheduledPayment storage sp = scheduledPayments[scheduleId];
        if (sp.owner == address(0)) revert ScheduleNotFound();
        if (sp.owner != msg.sender) revert NotScheduleOwner();
        sp.paused = true;
        emit SchedulePaused(scheduleId);
    }

    function resumeSchedule(uint256 scheduleId) external {
        ScheduledPayment storage sp = scheduledPayments[scheduleId];
        if (sp.owner == address(0)) revert ScheduleNotFound();
        if (sp.owner != msg.sender) revert NotScheduleOwner();
        sp.paused = false;
        emit ScheduleResumed(scheduleId);
    }

    function cancelSchedule(uint256 scheduleId) external {
        ScheduledPayment storage sp = scheduledPayments[scheduleId];
        if (sp.owner == address(0)) revert ScheduleNotFound();
        if (sp.owner != msg.sender) revert NotScheduleOwner();
        sp.cancelled = true;

        // Refund unused ETH pre-fund
        if (sp.token == address(0)) {
            uint256 remaining = sp.amount *
                (sp.maxExecutions - sp.executionCount);
            if (remaining > 0 && address(this).balance >= remaining) {
                (bool ok, ) = sp.owner.call{value: remaining}("");
                require(ok, "ETH refund failed");
            }
        }

        emit ScheduleCancelled(scheduleId);
    }

    function getOwnerSchedules(
        address owner_
    ) external view returns (uint256[] memory) {
        return ownerSchedules[owner_];
    }

    receive() external payable {}
}

// ──────────────────────────────────────────────────────────────────
//  Interfaces
// ──────────────────────────────────────────────────────────────────

interface IPaymentRouter {
    // no public functions called here — ScheduleModule executes transfers directly
}

interface IIdentityRegistry {
    function isRegistered(address user) external view returns (bool);
}
