import { NextRequest, NextResponse } from "next/server";

// Supports Pinata JWT (IPFS_API_KEY) — the recommended auth method.
const PINATA_JWT = process.env.IPFS_API_KEY;

/**
 * POST /api/ipfs/upload
 * Body: multipart/form-data with a "file" field.
 *
 * Uses Pinata JWT bearer auth (IPFS_API_KEY env var).
 *
 * SECURITY: API key is server-side only — never exposed to the client.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file     = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  if (!PINATA_JWT) {
    return NextResponse.json({ error: "IPFS not configured" }, { status: 503 });
  }

  const pinataForm = new FormData();
  pinataForm.append("file", file, file.name);

  // Primary: Pinata (JWT bearer auth)
  let cid: string | null = null;
  let pinataError: string | null = null;

  try {
    const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: pinataForm,
    });

    if (pinataRes.ok) {
      const json = await pinataRes.json();
      cid = json.IpfsHash as string;
    } else {
      pinataError = `Pinata: ${pinataRes.status}`;
    }
  } catch (e) {
    pinataError = `Pinata error: ${e}`;
  }

  if (!cid) {
    return NextResponse.json(
      { error: `Upload failed. ${pinataError ?? ""}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ cid });
}
