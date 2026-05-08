/**
 * Contract ABIs and address resolution for eChatz.
 * Addresses are injected via environment variables at build/runtime.
 */

export const CONTRACT_ADDRESSES = {
  identityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDR as `0x${string}`,
  inviteRegistry:   process.env.NEXT_PUBLIC_INVITE_REGISTRY_ADDR   as `0x${string}`,
  messageStore:     process.env.NEXT_PUBLIC_MESSAGE_STORE_ADDR      as `0x${string}`,
  paymentRouter:    process.env.NEXT_PUBLIC_PAYMENT_ROUTER_ADDR     as `0x${string}`,
  votingModule:     process.env.NEXT_PUBLIC_VOTING_MODULE_ADDR      as `0x${string}`,
} as const;

export const DECRYPT_SESSION_CONTRACTS = [
  CONTRACT_ADDRESSES.identityRegistry,
  CONTRACT_ADDRESSES.messageStore,
  CONTRACT_ADDRESSES.paymentRouter,
  CONTRACT_ADDRESSES.votingModule,
].filter(Boolean);

// ──────────────────────────────────────────────────────────────────
//  ABI fragments (only functions used by the frontend)
// ──────────────────────────────────────────────────────────────────

export const IDENTITY_REGISTRY_ABI = [
  "function isRegistered(address user) view returns (bool)",
  "function getPublicKey(address user) view returns (bytes)",
  "function registeredAt(address) view returns (uint256)",
  "function registerUser(bytes32 usernameHandle, bytes32 bioHandle, bytes calldata inputProof, bytes calldata publicKey) external",
  // Session key management
  "function registerSessionKey(address sessionKey) external",
  "function revokeSessionKey() external",
  "function getSessionKey(address owner) view returns (address)",
  "function sessionKeyOwner(address sessionKey) view returns (address)",
  "function resolveUser(address addr) view returns (address)",
  "event UserRegistered(address indexed user, uint256 timestamp)",
  "event SessionKeyRegistered(address indexed owner, address indexed sessionKey)",
  "event SessionKeyRevoked(address indexed owner, address indexed sessionKey)",
] as const;

export const INVITE_REGISTRY_ABI = [
  "function hasPendingInvite(address invitee) view returns (bool)",
  "function createInvite(address invitee, string inviteLink) external",
  "function cancelInvite(uint256 inviteId) external",
  "function getSentInvites(address inviter) view returns (uint256[])",
  "function invites(uint256) view returns (address inviter, address invitee, string inviteLink, uint256 createdAt, uint256 expiresAt, bool redeemed, bool cancelled)",
  "event InviteCreated(uint256 indexed inviteId, address indexed inviter, address indexed invitee, uint256 expiresAt)",
] as const;

export const MESSAGE_STORE_ABI = [
  "function sendMessage(address recipient, bytes32 contentHandle, bytes calldata inputProof, uint8 msgType, uint8 storType) external",
  "function getMessageContent(uint256 messageId) external returns (bytes32)",
  "function getMessageMeta(uint256 messageId) external view returns (address sender, address recipient, uint256 timestamp, uint8 messageType, uint8 storageType, uint256 threadId)",
  "function markRead(uint256 messageId) external",
  "function burnMessage(uint256 messageId) external",
  "function getThreadMessageIds(uint256 threadId, uint256 skip, uint256 first) view returns (uint256[])",
  "function getThreadId(address a, address b) view returns (uint256)",
  "function nextMessageId() view returns (uint256)",
  "function nextThreadId() view returns (uint256)",
  "event MessageSent(uint256 indexed messageId, uint256 indexed threadId, address indexed sender, address recipient, uint8 messageType, uint8 storageType, uint256 timestamp)",
  "event MessageRead(uint256 indexed messageId, address indexed reader)",
  "event MessageBurned(uint256 indexed messageId)",
] as const;

export const PAYMENT_ROUTER_ABI = [
  "function sendETH(address recipient, bytes32 noteHandle, bytes calldata inputProof) external payable",
  "function sendETHConfidential(address recipient, bytes32 encAmountHandle, bytes32 noteHandle, bytes calldata inputProof) external payable",
  "function sendERC20(address recipient, address token, uint256 amount, bytes32 noteHandle, bytes calldata inputProof) external",
  "function createRequest(address payer, address token, uint256 amount, bytes32 encAmountHandle, bytes32 noteHandle, bytes calldata inputProof) external",
  "function fulfillRequest(uint256 requestId) external payable",
  "function fulfillRequestConfidential(uint256 requestId, bytes32 encAmountHandle, bytes32 noteHandle, bytes calldata inputProof) external payable",
  "function paymentRequests(uint256) view returns (address requester, address payer, address token, uint256 amount, bytes32 encryptedAmount, bytes32 encryptedNote, bool fulfilled, uint256 createdAt)",
  "function createEscrow(address beneficiary, address arbitrator, address token, uint256 amount, bytes32 termsHandle, bytes calldata inputProof) external payable",
  "function approveEscrowRelease(uint256 escrowId) external",
  "function refundEscrow(uint256 escrowId) external",
  "function createSplit(address[] calldata participants, address token, uint256 totalAmount, bytes32 noteHandle, bytes calldata inputProof) external",
  "function contributeToSplit(uint256 splitId) external payable",
  "function feeBps() view returns (uint16)",
  "event PaymentSent(address indexed from, address indexed to, address token, uint256 amount, uint256 timestamp)",
  "event RequestCreated(uint256 indexed requestId, address indexed requester, address indexed payer, address token)",
  "event EscrowCreated(uint256 indexed escrowId, address indexed depositor, address indexed beneficiary, address arbitrator)",
] as const;

export const VOTING_MODULE_ABI = [
  "function createPoll(uint256 threadId, string calldata question, string[] calldata optionLabels) external",
  "function castVote(uint256 pollId, bytes32 choiceHandle, bytes calldata inputProof) external",
  "function closePoll(uint256 pollId, address[] calldata grantees) external",
  "function getTallyHandle(uint256 pollId, uint8 optionIndex) external returns (bytes32)",
  "function getPollMeta(uint256 pollId) view returns (address creator, uint256 threadId, string question, string[] optionLabels, uint8 optionCount, uint8 state, uint256 createdAt, uint256 closedAt, uint256 voterCount)",
  "function hasVoted(uint256 pollId, address voter) view returns (bool)",
  "event PollCreated(uint256 indexed pollId, address indexed creator, uint256 indexed threadId, string question)",
  "event VoteCast(uint256 indexed pollId, address indexed voter)",
  "event PollClosed(uint256 indexed pollId, uint256 closedAt)",
] as const;
