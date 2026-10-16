import { NextResponse } from "next/server";
import { confirmUnresolved, getIssue } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const issue = getIssue(id);
  if (issue?.originNodeId) return NextResponse.json({ error: "Update this report on its origin node." }, { status: 409 });
  if (!issue) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ issue: confirmUnresolved(id) });
}
