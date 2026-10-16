import { validEnvelope } from "@/lib/federation/validation";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { FederatedIssuePayload, ReceiptEnvelope } from "@/types/civic";

// Deterministic JSON serialization with recursively sorted object keys, so that
// the signed bytes are identical on the signing and verifying nodes regardless
// of property insertion order.
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
  }

  return value;
}

// The exact bytes covered by the signature: everything in the envelope except
// the signature field itself.
function signingInput(parts: {
  version: number;
  originNodeId: string;
  emittedAt: string;
  payload: FederatedIssuePayload;
}): string {
  return canonicalize({
    version: parts.version,
    originNodeId: parts.originNodeId,
    emittedAt: parts.emittedAt,
    payload: parts.payload
  });
}

export function signPayload(
  parts: { version: number; originNodeId: string; emittedAt: string; payload: FederatedIssuePayload },
  secret: string
): string {
  return createHmac("sha256", secret).update(signingInput(parts)).digest("hex");
}

export function createEnvelope(
  originNodeId: string,
  payload: FederatedIssuePayload,
  secret: string,
  emittedAt = new Date().toISOString()
): ReceiptEnvelope {
  const version = 1 as const;
  const signature = signPayload({ version, originNodeId, emittedAt, payload }, secret);

  return { version, originNodeId, payload, emittedAt, signature };
}

// Verifies an envelope's HMAC signature against the shared secret using a
// constant-time comparison. Returns false for any structural or crypto mismatch.
export function verifyEnvelope(envelope: unknown, secret: string): boolean {
  if (!validEnvelope(envelope)) {
    return false;
  }

  const expected = signPayload(
    {
      version: envelope.version,
      originNodeId: envelope.originNodeId,
      emittedAt: envelope.emittedAt,
      payload: envelope.payload
    },
    secret
  );

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(envelope.signature, "hex");

  if (a.length !== b.length || a.length === 0) {
    return false;
  }

  return timingSafeEqual(a, b);
}
