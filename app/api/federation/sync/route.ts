import { NextResponse } from "next/server";
import { syncWithPeers } from "@/lib/federation/service";

export const runtime = "nodejs";

// Triggers a pull from every configured peer. Tolerant of offline peers: each
// peer's outcome is reported independently and cursors advance only on success.
export async function POST() {
  try { return NextResponse.json({ peers: await syncWithPeers() }); }
  catch { return NextResponse.json({ error: "Configure federation before syncing." }, { status: 503 }); }
}
