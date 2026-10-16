import { NextResponse } from "next/server";
import { buildFeed, importEnvelopes } from "@/lib/federation/service";
import { getNodeId } from "@/lib/federation/config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const since = new URL(request.url).searchParams.get("since") || undefined;
  if (since && !/^s:\d+$/.test(since)) return NextResponse.json({ error: "Invalid sequence cursor." }, { status: 400 });
  try { return NextResponse.json({ nodeId: getNodeId(), ...buildFeed(since) }); }
  catch { return NextResponse.json({ error: "Configure a unique node ID and shared secret." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 2_000_000) return NextResponse.json({ error: "Batch too large." }, { status: 413 });
    const body = JSON.parse(raw);
    if (!Array.isArray(body?.envelopes) || body.envelopes.length > 200) {
      return NextResponse.json({ error: "Provide an envelopes array with at most 200 entries." }, { status: 400 });
    }
    return NextResponse.json(importEnvelopes(body.envelopes));
  } catch {
    return NextResponse.json({ error: "Invalid receipt batch." }, { status: 400 });
  }
}
