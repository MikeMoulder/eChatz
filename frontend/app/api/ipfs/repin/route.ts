import { NextRequest, NextResponse } from "next/server";

const PINATA_JWT = process.env.IPFS_API_KEY;

/**
 * POST /api/ipfs/repin
 * Body: { cid: string }
 *
 * Re-pin on every successful fetch to refresh TTL.
 * Fire-and-forget from client — always returns 200.
 */
export async function POST(req: NextRequest) {
  try {
    const { cid } = await req.json() as { cid?: string };
    if (!cid || !PINATA_JWT) {
      return NextResponse.json({ ok: false });
    }

    await fetch("https://api.pinata.cloud/pinning/pinByHash", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({ hashToPin: cid }),
    });
  } catch {
    // intentionally silent
  }

  return NextResponse.json({ ok: true });
}
