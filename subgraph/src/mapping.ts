import {
  BigInt,
  store,
} from "@graphprotocol/graph-ts";

// ─── IdentityRegistry ────────────────────────────────────────────

import { UserRegistered } from "../generated/IdentityRegistry/IdentityRegistry";
import { RegisteredUser } from "../generated/schema";

export function handleUserRegistered(event: UserRegistered): void {
  const id = event.params.user.toHexString();
  let entity = RegisteredUser.load(id);
  if (!entity) {
    entity = new RegisteredUser(id);
  }
  entity.registeredAt = event.params.timestamp;
  entity.save();
}

// ─── InviteRegistry ──────────────────────────────────────────────

import {
  InviteCreated,
  InviteRedeemed,
  InviteCancelled,
} from "../generated/InviteRegistry/InviteRegistry";
import { Invite } from "../generated/schema";

export function handleInviteCreated(event: InviteCreated): void {
  const id     = event.params.inviteId.toString();
  let   entity = new Invite(id);
  entity.inviter    = event.params.inviter.toHexString();
  entity.invitee    = event.params.invitee.toHexString();
  entity.inviteLink = "";   // off-chain, not in event
  entity.createdAt  = event.block.timestamp;
  entity.expiresAt  = event.params.expiresAt;
  entity.redeemed   = false;
  entity.cancelled  = false;
  entity.save();
}

export function handleInviteRedeemed(event: InviteRedeemed): void {
  const entity = Invite.load(event.params.inviteId.toString());
  if (entity) {
    entity.redeemed = true;
    entity.save();
  }
}

export function handleInviteCancelled(event: InviteCancelled): void {
  const entity = Invite.load(event.params.inviteId.toString());
  if (entity) {
    entity.cancelled = true;
    entity.save();
  }
}

// ─── MessageStore ────────────────────────────────────────────────

import { MessageSent } from "../generated/MessageStore/MessageStore";
import { Message, Thread } from "../generated/schema";

export function handleMessageSent(event: MessageSent): void {
  // Update or create Thread
  const threadIdStr = event.params.threadId.toString();
  let   thread      = Thread.load(threadIdStr);
  if (!thread) {
    thread = new Thread(threadIdStr);
    thread.participants  = [
      event.params.sender.toHexString(),
      event.params.recipient.toHexString(),
    ];
    thread.messageCount  = BigInt.fromI32(0);
    thread.lastActivity  = event.block.timestamp;
  }
  thread.messageCount = thread.messageCount.plus(BigInt.fromI32(1));
  thread.lastActivity = event.block.timestamp;
  thread.save();

  // Create Message (metadata only — no ciphertext handles)
  const msgId  = event.params.messageId.toString();
  const msg    = new Message(msgId);
  msg.thread      = threadIdStr;
  msg.sender      = event.params.sender.toHexString();
  msg.recipient   = event.params.recipient.toHexString();
  msg.timestamp   = event.params.timestamp;
  msg.messageType = event.params.messageType;
  msg.storageType = event.params.storageType;
  msg.save();
}

// ─── PaymentRouter ───────────────────────────────────────────────

import {
  PaymentSent,
  RequestCreated,
  RequestFulfilled,
  EscrowCreated,
  EscrowReleased,
  EscrowRefunded,
} from "../generated/PaymentRouter/PaymentRouter";
import {
  PaymentEvent,
  PaymentRequest,
  EscrowEvent,
} from "../generated/schema";

export function handlePaymentSent(event: PaymentSent): void {
  const id     = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const entity = new PaymentEvent(id);
  entity.from      = event.params.from.toHexString();
  entity.to        = event.params.to.toHexString();
  entity.token     = event.params.token.toHexString();
  entity.amount    = event.params.amount;
  entity.timestamp = event.params.timestamp;
  entity.save();
}

export function handleRequestCreated(event: RequestCreated): void {
  const id     = event.params.requestId.toString();
  const entity = new PaymentRequest(id);
  entity.requester  = event.params.requester.toHexString();
  entity.payer      = event.params.payer.toHexString();
  entity.token      = event.params.token.toHexString();
  entity.createdAt  = event.block.timestamp;
  entity.fulfilled  = false;
  entity.save();
}

export function handleRequestFulfilled(event: RequestFulfilled): void {
  const entity = PaymentRequest.load(event.params.requestId.toString());
  if (entity) {
    entity.fulfilled = true;
    entity.save();
  }
}

export function handleEscrowCreated(event: EscrowCreated): void {
  const id     = event.params.escrowId.toString();
  const entity = new EscrowEvent(id);
  entity.depositor   = event.params.depositor.toHexString();
  entity.beneficiary = event.params.beneficiary.toHexString();
  entity.arbitrator  = event.params.arbitrator.toHexString();
  entity.createdAt   = event.block.timestamp;
  entity.released    = false;
  entity.refunded    = false;
  entity.save();
}

export function handleEscrowReleased(event: EscrowReleased): void {
  const entity = EscrowEvent.load(event.params.escrowId.toString());
  if (entity) {
    entity.released = true;
    entity.save();
  }
}

export function handleEscrowRefunded(event: EscrowRefunded): void {
  const entity = EscrowEvent.load(event.params.escrowId.toString());
  if (entity) {
    entity.refunded = true;
    entity.save();
  }
}

// ─── VotingModule ────────────────────────────────────────────────

import {
  PollCreated,
  VoteCast,
  PollClosed,
} from "../generated/VotingModule/VotingModule";
import { Poll, VoteEvent } from "../generated/schema";

export function handlePollCreated(event: PollCreated): void {
  const id     = event.params.pollId.toString();
  const entity = new Poll(id);
  entity.creator      = event.params.creator.toHexString();
  entity.threadId     = event.params.threadId;
  entity.question     = event.params.question;
  entity.optionLabels = [];
  entity.voterCount   = BigInt.fromI32(0);
  entity.state        = "Open";
  entity.createdAt    = event.block.timestamp;
  entity.closedAt     = null;
  entity.save();
}

export function handleVoteCast(event: VoteCast): void {
  const poll = Poll.load(event.params.pollId.toString());
  if (poll) {
    poll.voterCount = poll.voterCount.plus(BigInt.fromI32(1));
    poll.save();
  }

  const voteId = event.params.pollId.toString() + "-" + event.params.voter.toHexString();
  const vote   = new VoteEvent(voteId);
  vote.poll      = event.params.pollId.toString();
  vote.voter     = event.params.voter.toHexString();
  vote.timestamp = event.block.timestamp;
  vote.save();
}

export function handlePollClosed(event: PollClosed): void {
  const poll = Poll.load(event.params.pollId.toString());
  if (poll) {
    poll.state    = "Closed";
    poll.closedAt = event.params.closedAt;
    poll.save();
  }
}
