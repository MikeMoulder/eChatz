"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { BrowserProvider, Contract } from "ethers";
import { CONTRACT_ADDRESSES, MESSAGE_STORE_ABI } from "@/lib/contracts";

export interface InboxThread {
  threadId: string;
  peerAddress: string;   // the other participant
  messageCount: number;
  lastActivity: number;  // unix seconds
}

const GRAPH_URL = process.env.NEXT_PUBLIC_GRAPH_URL ?? "";
const MESSAGE_SCAN_FROM_BLOCK = Number(process.env.NEXT_PUBLIC_MESSAGE_SCAN_FROM_BLOCK ?? "0");
const FALLBACK_SCAN_BLOCKS = Number(process.env.NEXT_PUBLIC_MESSAGE_FALLBACK_SCAN_BLOCKS ?? "25000");

const INBOX_QUERY = `
  query InboxThreads($address: String!) {
    threads(
      where: { participants_contains: [$address] }
      orderBy: lastActivity
      orderDirection: desc
      first: 50
    ) {
      id
      participants
      messageCount
      lastActivity
    }
  }
`;

export function useInbox() {
  const { address } = useAccount();
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInbox = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [graphThreads, chainThreads] = await Promise.all([
        fetchGraphInbox(address),
        fetchChainInbox(address),
      ]);
      setThreads(mergeThreads(graphThreads, chainThreads));
    } catch {
      // Network, RPC, or subgraph error: keep existing threads.
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchInbox();
    const id = setInterval(fetchInbox, 15_000);
    return () => clearInterval(id);
  }, [fetchInbox]);

  return { threads, loading, refresh: fetchInbox };
}

async function fetchGraphInbox(address: string): Promise<InboxThread[]> {
  if (!GRAPH_URL) return [];

  const res = await fetch(GRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: INBOX_QUERY,
      variables: { address: address.toLowerCase() },
    }),
  });

  if (!res.ok) return [];

  const json = await res.json();
  const raw: Array<{
    id: string;
    participants: string[];
    messageCount: string;
    lastActivity: string;
  }> = json.data?.threads ?? [];

  return raw
    .map((t) => ({
      threadId: t.id,
      peerAddress: t.participants.find((p) => p.toLowerCase() !== address.toLowerCase()) ?? "",
      messageCount: Number(t.messageCount),
      lastActivity: Number(t.lastActivity),
    }))
    .filter((t) => t.peerAddress);
}

async function fetchChainInbox(address: string): Promise<InboxThread[]> {
  if (typeof window === "undefined" || !window.ethereum || !CONTRACT_ADDRESSES.messageStore) {
    return [];
  }

  const provider = new BrowserProvider(window.ethereum);
  const contract = new Contract(CONTRACT_ADDRESSES.messageStore, MESSAGE_STORE_ABI, provider);
  const latest = await provider.getBlockNumber();
  const primaryFromBlock = MESSAGE_SCAN_FROM_BLOCK > 0 ? MESSAGE_SCAN_FROM_BLOCK : 0;

  let events: Awaited<ReturnType<typeof contract.queryFilter>>;
  try {
    events = await contract.queryFilter(contract.filters.MessageSent(), primaryFromBlock, latest);
  } catch {
    const fallbackFromBlock = Math.max(0, latest - FALLBACK_SCAN_BLOCKS);
    events = await contract.queryFilter(contract.filters.MessageSent(), fallbackFromBlock, latest);
  }

  const mine = address.toLowerCase();
  const byThread = new Map<string, InboxThread>();

  for (const event of events) {
    if (!("args" in event) || !event.args) continue;

    const sender = String(event.args.sender);
    const recipient = String(event.args.recipient);
    const senderLower = sender.toLowerCase();
    const recipientLower = recipient.toLowerCase();
    if (senderLower !== mine && recipientLower !== mine) continue;

    const threadId = event.args.threadId.toString();
    const timestamp = Number(event.args.timestamp);
    const peerAddress = senderLower === mine ? recipient : sender;
    const existing = byThread.get(threadId);

    byThread.set(threadId, {
      threadId,
      peerAddress,
      messageCount: (existing?.messageCount ?? 0) + 1,
      lastActivity: Math.max(existing?.lastActivity ?? 0, timestamp),
    });
  }

  return Array.from(byThread.values());
}

function mergeThreads(...sources: InboxThread[][]): InboxThread[] {
  const byPeer = new Map<string, InboxThread>();

  for (const source of sources) {
    for (const thread of source) {
      const key = thread.peerAddress.toLowerCase();
      const existing = byPeer.get(key);
      if (!existing) {
        byPeer.set(key, thread);
        continue;
      }

      byPeer.set(key, {
        threadId: existing.threadId || thread.threadId,
        peerAddress: existing.peerAddress,
        messageCount: Math.max(existing.messageCount, thread.messageCount),
        lastActivity: Math.max(existing.lastActivity, thread.lastActivity),
      });
    }
  }

  return Array.from(byPeer.values()).sort((a, b) => b.lastActivity - a.lastActivity);
}
