// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint256, externalEbool, externalEuint256} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title IdentityRegistry
 * @notice Manages eChatz user registration, public keys, profiles, contact lists,
 *         blocklists, and device links.
 *
 * CORRECTIONS FROM SPEC:
 *  - encrypted profile fields are represented as euint256 handles
 *  - FHE.* API (not TFHE.*)
 *  - ACL grants added after every encrypted state write
 *  - publicKeys stored as plaintext bytes — used for identity verification only;
 *    NOT for FHE encryption (fhEVM uses global KMS key, not per-user keys)
 *  - pragma ^0.8.27, SepoliaConfig inheritance
 */
contract IdentityRegistry is ZamaEthereumConfig, Ownable2Step {
    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    mapping(address => bool) public registered;
    mapping(address => uint256) public registeredAt;

    /// @dev 65-byte uncompressed ECDSA public key. Stored for identity
    ///      verification only — NOT used for FHE encryption.
    mapping(address => bytes) public publicKeys;

    /// @dev Encrypted profile fields — single ciphertext under global KMS key.
    ///      ACL grants allow the owning user to decrypt via relayer flow.
    mapping(address => euint256) private encryptedUsername;
    mapping(address => euint256) private encryptedBio;

    /// @dev Encrypted per-address flags/data
    mapping(address => mapping(address => ebool)) private blocklist;
    mapping(address => mapping(address => euint256)) private contactNicknames;
    mapping(address => mapping(address => ebool)) private acceptedContacts;

    mapping(address => address[]) private linkedDevices;

    // ── Session key registry ───────────────────────────────────────────
    // Each registered user may bind one deterministic gas wallet (session key).
    // The session key signs sendMessage() txs so MetaMask is not prompted.
    // The session key is derived client-side from a deterministic MetaMask sig,
    // so the user can always re-derive the same address after clearing storage.
    mapping(address => address) public sessionKeys; // owner  → sessionKey
    mapping(address => address) public sessionKeyOwner; // sessionKey → owner

    /// @dev InviteRegistry address, set post-deployment
    address public inviteRegistry;

    // ──────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────

    event UserRegistered(address indexed user, uint256 timestamp);
    event InviteRegistrySet(address indexed inviteRegistry);
    event ContactAdded(address indexed owner, address indexed contact);
    event ContactAccepted(address indexed owner, address indexed contact);
    event AddressBlocked(address indexed owner, address indexed blocked);
    event DeviceLinked(address indexed owner, address indexed device);
    event SessionKeyRegistered(
        address indexed owner,
        address indexed sessionKey
    );
    event SessionKeyRevoked(address indexed owner, address indexed sessionKey);

    // ──────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────

    error AlreadyRegistered();
    error InvalidPublicKeyLength();
    error PublicKeyAddressMismatch();
    error UserNotRegistered();
    error NotSelf();
    error DeviceLimitReached();
    error InviteRegistryNotSet();
    error NotInviteRegistry();
    error SessionKeyZeroAddress();
    error SessionKeyCannotBeSelf();
    error NoSessionKeyRegistered();

    // ──────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ──────────────────────────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────────────────────────

    /// @notice Set InviteRegistry address post-deployment. Can only be set once.
    function setInviteRegistry(address _inviteRegistry) external onlyOwner {
        require(inviteRegistry == address(0), "already set");
        inviteRegistry = _inviteRegistry;
        emit InviteRegistrySet(_inviteRegistry);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Registration
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Register the caller as an eChatz user.
     * @param usernameHandle  externalEuint256 handle from relayer SDK for encrypted username
     * @param bioHandle       externalEuint256 handle from relayer SDK for encrypted bio
     * @param inputProof      Proof bundle from relayer SDK (covers both handles)
     * @param publicKey       65-byte uncompressed ECDSA public key (identity only, not for FHE encryption)
     *
     * NOTE: Both username and bio are encrypted under the global fhEVM KMS key.
     *       The caller's address is ACL-granted so they can decrypt via the relayer flow.
     *       publicKey is used only for the _verifyPublicKey identity check.
     */
    function registerUser(
        externalEuint256 usernameHandle,
        externalEuint256 bioHandle,
        bytes calldata inputProof,
        bytes calldata publicKey
    ) external {
        if (registered[msg.sender]) revert AlreadyRegistered();
        if (publicKey.length != 65) revert InvalidPublicKeyLength();
        if (!_verifyPublicKey(publicKey, msg.sender))
            revert PublicKeyAddressMismatch();

        // Verify and load encrypted inputs from relayer
        euint256 username = FHE.fromExternal(usernameHandle, inputProof);
        euint256 bio = FHE.fromExternal(bioHandle, inputProof);

        // Mark registered
        registered[msg.sender] = true;
        registeredAt[msg.sender] = block.timestamp;
        publicKeys[msg.sender] = publicKey;

        // Store encrypted profile fields
        encryptedUsername[msg.sender] = username;
        encryptedBio[msg.sender] = bio;

        // ACL: grant the user decrypt rights on their own profile
        FHE.allowThis(username);
        FHE.allow(username, msg.sender);
        FHE.allowThis(bio);
        FHE.allow(bio, msg.sender);

        emit UserRegistered(msg.sender, block.timestamp);

        // Notify InviteRegistry if there's a pending invite
        if (inviteRegistry != address(0)) {
            // Call is best-effort; failure must not block registration
            (bool ok, ) = inviteRegistry.call(
                abi.encodeWithSignature("redeemInvite(address)", msg.sender)
            );
            // Silence unused variable warning
            ok;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  Profile reads (encrypted handles returned to caller)
    // ──────────────────────────────────────────────────────────────────

    function getUsernameHandle(address user) external returns (euint256) {
        if (!registered[user]) revert UserNotRegistered();
        FHE.allow(encryptedUsername[user], msg.sender);
        return encryptedUsername[user];
    }

    function getBioHandle(address user) external returns (euint256) {
        if (!registered[user]) revert UserNotRegistered();
        FHE.allow(encryptedBio[user], msg.sender);
        return encryptedBio[user];
    }

    // ──────────────────────────────────────────────────────────────────
    //  Public Key (identity verification only)
    // ──────────────────────────────────────────────────────────────────

    function getPublicKey(address user) external view returns (bytes memory) {
        if (!registered[user]) revert UserNotRegistered();
        return publicKeys[user];
    }

    function isRegistered(address user) external view returns (bool) {
        return registered[user];
    }

    // ──────────────────────────────────────────────────────────────────
    //  Contacts
    // ──────────────────────────────────────────────────────────────────

    function addContact(
        address addr,
        externalEuint256 nicknameHandle,
        bytes calldata inputProof
    ) external {
        euint256 nickname = FHE.fromExternal(nicknameHandle, inputProof);
        contactNicknames[msg.sender][addr] = nickname;
        FHE.allowThis(nickname);
        FHE.allow(nickname, msg.sender);
        emit ContactAdded(msg.sender, addr);
    }

    function acceptContact(address addr) external {
        ebool accepted = FHE.asEbool(true);
        acceptedContacts[msg.sender][addr] = accepted;
        FHE.allowThis(accepted);
        FHE.allow(accepted, msg.sender);
        emit ContactAccepted(msg.sender, addr);
    }

    function getContactNicknameHandle(
        address contact
    ) external returns (euint256) {
        FHE.allow(contactNicknames[msg.sender][contact], msg.sender);
        return contactNicknames[msg.sender][contact];
    }

    function isContactAccepted(
        address owner,
        address contact
    ) external view returns (bool) {
        // Public bool for contract-level gating in MessageStore
        // The encrypted acceptedContacts is for UI display only
        return FHE.isInitialized(acceptedContacts[owner][contact]);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Blocklist
    // ──────────────────────────────────────────────────────────────────

    function blockAddress(address addr) external {
        ebool blocked = FHE.asEbool(true);
        blocklist[msg.sender][addr] = blocked;
        FHE.allowThis(blocked);
        FHE.allow(blocked, msg.sender);
        emit AddressBlocked(msg.sender, addr);
    }

    /// @notice Plaintext read for contract-level gating (MessageStore uses this).
    function isBlocked(
        address owner,
        address target
    ) external view returns (bool) {
        return FHE.isInitialized(blocklist[owner][target]);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Device linking
    // ──────────────────────────────────────────────────────────────────

    function linkDevice(address deviceAddr) external {
        if (linkedDevices[msg.sender].length >= 5) revert DeviceLimitReached();
        linkedDevices[msg.sender].push(deviceAddr);
        emit DeviceLinked(msg.sender, deviceAddr);
    }

    function getLinkedDevices(
        address user
    ) external view returns (address[] memory) {
        return linkedDevices[user];
    }

    // ──────────────────────────────────────────────────────────────────
    //  Session key management
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Bind a session key (gas wallet) to msg.sender.
     *         The session key is a deterministic ephemeral wallet held in the
     *         user's browser. It signs sendMessage() transactions so the user's
     *         main wallet is never prompted per-message.
     *
     *         Calling again replaces the previous session key (one active key
     *         per user at a time). The old binding is atomically revoked.
     */
    function registerSessionKey(address sessionKey) external {
        if (!registered[msg.sender]) revert UserNotRegistered();
        if (sessionKey == address(0)) revert SessionKeyZeroAddress();
        if (sessionKey == msg.sender) revert SessionKeyCannotBeSelf();

        // Revoke old session key binding if one exists
        address old = sessionKeys[msg.sender];
        if (old != address(0)) {
            delete sessionKeyOwner[old];
            emit SessionKeyRevoked(msg.sender, old);
        }

        sessionKeys[msg.sender] = sessionKey;
        sessionKeyOwner[sessionKey] = msg.sender;
        emit SessionKeyRegistered(msg.sender, sessionKey);
    }

    /**
     * @notice Revoke the caller's current session key.
     */
    function revokeSessionKey() external {
        address sk = sessionKeys[msg.sender];
        if (sk == address(0)) revert NoSessionKeyRegistered();
        delete sessionKeyOwner[sk];
        delete sessionKeys[msg.sender];
        emit SessionKeyRevoked(msg.sender, sk);
    }

    /**
     * @notice Return the session key registered for `owner`, or address(0).
     */
    function getSessionKey(address owner) external view returns (address) {
        return sessionKeys[owner];
    }

    /**
     * @notice If `addr` is a registered session key, return its owner.
     *         Otherwise return `addr` itself (identity pass-through).
     *         Used by MessageStore to resolve the real sender.
     */
    function resolveUser(address addr) external view returns (address) {
        address owner = sessionKeyOwner[addr];
        return owner != address(0) ? owner : addr;
    }

    // ──────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ──────────────────────────────────────────────────────────────────

    /**
     * @dev Derive Ethereum address from uncompressed 65-byte public key and
     *      verify it matches `expected`.
     *      Derivation: address(uint160(uint256(keccak256(pubkey[1:65]))))
     */
    function _verifyPublicKey(
        bytes calldata publicKey,
        address expected
    ) internal pure returns (bool) {
        bytes32 hash = keccak256(publicKey[1:65]);
        address derived = address(uint160(uint256(hash)));
        return derived == expected;
    }
}
