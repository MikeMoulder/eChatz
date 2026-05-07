// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title InviteRegistry
 * @notice Manages eChatz invite links. Invites gate new user registration.
 *
 * No FHE state in this contract — invite links are plaintext off-chain.
 * Only metadata (inviter, invitee, expiry) is stored on-chain.
 *
 * CORRECTIONS FROM SPEC:
 *  - pragma ^0.8.27
 *  - No TFHE usage (this contract has none)
 */
contract InviteRegistry is ZamaEthereumConfig, Ownable2Step {
    // ──────────────────────────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────────────────────────

    struct Invite {
        address inviter;
        address invitee;
        string inviteLink; // off-chain slug/UUID — NOT on-chain secret
        uint256 createdAt;
        uint256 expiresAt;
        bool redeemed;
        bool cancelled;
    }

    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    IIdentityRegistry public immutable identityRegistry;

    uint256 public nextInviteId;

    mapping(uint256 => Invite) public invites;
    mapping(address => uint256) public pendingInviteOf; // invitee → inviteId
    mapping(address => uint256[]) public sentInvitesOf; // inviter → list of inviteIds

    uint256 public constant INVITE_DURATION = 7 days;

    // ──────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────

    event InviteCreated(
        uint256 indexed inviteId,
        address indexed inviter,
        address indexed invitee,
        uint256 expiresAt
    );
    event InviteRedeemed(uint256 indexed inviteId, address indexed invitee);
    event InviteCancelled(uint256 indexed inviteId, address indexed inviter);

    // ──────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────

    error InviterNotRegistered();
    error InviteeLinkMismatch();
    error InviteAlreadyExists();
    error InviteExpired();
    error InviteNotPending();
    error NotInviter();
    error CallerNotIdentityRegistry();
    error InvalidInviteId();

    // ──────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────

    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Invite lifecycle
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Create an invite for `invitee` address.
     * @param invitee     Address that will redeem this invite.
     * @param inviteLink  Off-chain UUID slug stored as reference.
     */
    function createInvite(
        address invitee,
        string calldata inviteLink
    ) external {
        if (!identityRegistry.isRegistered(msg.sender))
            revert InviterNotRegistered();
        if (pendingInviteOf[invitee] != 0) revert InviteAlreadyExists();

        nextInviteId++;
        uint256 id = nextInviteId;
        uint256 expiresAt = block.timestamp + INVITE_DURATION;

        invites[id] = Invite({
            inviter: msg.sender,
            invitee: invitee,
            inviteLink: inviteLink,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            redeemed: false,
            cancelled: false
        });

        pendingInviteOf[invitee] = id;
        sentInvitesOf[msg.sender].push(id);

        emit InviteCreated(id, msg.sender, invitee, expiresAt);
    }

    /**
     * @notice Check if an address has a pending (non-expired, non-cancelled) invite.
     */
    function hasPendingInvite(address invitee) external view returns (bool) {
        uint256 id = pendingInviteOf[invitee];
        if (id == 0) return false;
        Invite storage inv = invites[id];
        return
            !inv.redeemed && !inv.cancelled && block.timestamp <= inv.expiresAt;
    }

    /**
     * @notice Called by IdentityRegistry when a new user registers.
     *         Marks their pending invite as redeemed.
     */
    function redeemInvite(address invitee) external {
        if (msg.sender != address(identityRegistry))
            revert CallerNotIdentityRegistry();

        uint256 id = pendingInviteOf[invitee];
        if (id == 0) return; // no invite, silently skip

        Invite storage inv = invites[id];
        if (inv.redeemed || inv.cancelled) return;
        if (block.timestamp > inv.expiresAt) return;

        inv.redeemed = true;
        delete pendingInviteOf[invitee];

        emit InviteRedeemed(id, invitee);
    }

    /**
     * @notice Inviter cancels their outstanding invite.
     */
    function cancelInvite(uint256 inviteId) external {
        if (inviteId == 0 || inviteId > nextInviteId) revert InvalidInviteId();
        Invite storage inv = invites[inviteId];
        if (inv.inviter != msg.sender) revert NotInviter();
        if (inv.redeemed || inv.cancelled) revert InviteNotPending();

        inv.cancelled = true;
        delete pendingInviteOf[inv.invitee];

        emit InviteCancelled(inviteId, msg.sender);
    }

    /**
     * @notice Get all invite IDs sent by an address.
     */
    function getSentInvites(
        address inviter
    ) external view returns (uint256[] memory) {
        return sentInvitesOf[inviter];
    }
}

// ──────────────────────────────────────────────────────────────────
//  Interface: IdentityRegistry (minimal surface used here)
// ──────────────────────────────────────────────────────────────────

interface IIdentityRegistry {
    function isRegistered(address user) external view returns (bool);
}
