import { getStore } from "@/lib/storage";
import type {
  FederationPeerStatus,
  FederationStatus,
  ReceiptEnvelope
} from "@/types/civic";
import { getNodeId, getNodeSecret, getPeers, isSigningConfigured } from "@/lib/federation/config";
import { validEnvelope } from "@/lib/federation/validation";
import { createEnvelope, verifyEnvelope } from "@/lib/federation/signing";
import { envelopeToIssue, issueToPayload } from "@/lib/federation/envelope";

const FEED_LIMIT = 200;
const PEER_TIMEOUT_MS = 10_000;

export type FeedResult = {
  envelopes: ReceiptEnvelope[];
  cursor: string | undefined;
  hasMore: boolean;
};

// Sequence bookmarks cover local creations and edits; sample receipts stay local.
export function buildFeed(since: string | undefined, limit = FEED_LIMIT): FeedResult {
  const secret = getNodeSecret();

  if (!secret) {
    return { envelopes: [], cursor: since, hasMore: false };
  }

  const nodeId = getNodeId();
  if (!nodeId || nodeId.length > 128 || nodeId === "local-node") throw new Error("Set a unique PARAREPORT_NODE_ID before enabling federation.");
  const changes = getStore().localIssuesSince(since, Math.min(Math.max(limit, 1), FEED_LIMIT));
  const envelopes: ReceiptEnvelope[] = [];
  let size = 0;
  for (const { issue } of changes) {
    const envelope = createEnvelope(nodeId, issueToPayload(issue), secret);
    const bytes = Buffer.byteLength(JSON.stringify(envelope));
    if (size + bytes > 1_500_000) break;
    envelopes.push(envelope); size += bytes;
  }
  const cursor = envelopes.length ? `s:${changes[envelopes.length - 1].sequence}` : since;
  return { envelopes, cursor, hasMore: envelopes.length < changes.length || changes.length === Math.min(Math.max(limit, 1), FEED_LIMIT) };
}

export type ImportResult = {
  imported: number;
  rejected: number;
};

// Apply valid newer snapshots; duplicates and older snapshots leave the stored view intact.
export function importEnvelopes(envelopes: unknown[]): ImportResult {
  const secret = getNodeSecret();
  const store = getStore();
  let imported = 0;
  let rejected = 0;

  for (const envelope of envelopes) {
    if (!secret || !validEnvelope(envelope) || !verifyEnvelope(envelope, secret) || envelope.originNodeId === getNodeId()) {
      rejected += 1;
      continue;
    }

    const issue = envelopeToIssue(envelope);

    if (store.upsertRemote(issue)) {
      imported += 1;
    }
  }

  return { imported, rejected };
}

// Bounded pulls leave a resumable cursor after each fully validated page.
export async function syncWithPeers(): Promise<FederationPeerStatus[]> {
  if (!isSigningConfigured() || !getNodeId() || getNodeId() === "local-node") throw new Error("Configure a unique node ID and secret before syncing.");
  const store = getStore();
  const results: FederationPeerStatus[] = [];
  for (const peer of getPeers()) {
    let cursor = store.getPeerCursor(peer);
    let imported = 0;
    try {
      let hasMore = false;
      for (let page = 0; page < 20; page++) {
        const url = new URL(`${peer}/api/federation/receipts`);
        if (cursor) url.searchParams.set("since", cursor);
        const response = await fetch(url, { signal: AbortSignal.timeout(PEER_TIMEOUT_MS), redirect: "error" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const raw = await response.text();
        if (raw.length > 2_000_000) throw new Error("Peer response is too large.");
        const body = JSON.parse(raw);
        if (!body || typeof body.nodeId !== "string" || body.nodeId === getNodeId() || !Array.isArray(body.envelopes) || body.envelopes.length > FEED_LIMIT ||
            (body.cursor !== undefined && (typeof body.cursor !== "string" || !/^s:\d+$/.test(body.cursor)))) {
          throw new Error("Invalid peer feed or duplicate node identity.");
        }
        const result = importEnvelopes(body.envelopes);
        imported += result.imported;
        if (result.rejected) throw new Error(`${result.rejected} receipts rejected; cursor retained for retry.`);
        hasMore = body.hasMore === true;
        if (hasMore && !body.envelopes.length) throw new Error("Peer returned an empty unfinished page.");
        if (body.envelopes.length && (!body.cursor || Number(body.cursor.slice(2)) <= Number(cursor?.slice(2) ?? 0))) {
          throw new Error("Peer cursor did not advance.");
        }
        if (body.cursor) { cursor = body.cursor; store.setPeerCursor(peer, cursor!); }
        if (!hasMore) break;
      }
      results.push({ url: peer, reachable: true, imported, lastCursor: cursor,
        ...(hasMore ? { error: "More receipts remain; sync again to continue." } : {}) });
    } catch (error) {
      results.push({ url: peer, reachable: false, imported, lastCursor: cursor,
        error: error instanceof Error ? error.message : "Peer unavailable" });
    }
  }
  return results;
}

export function getFederationStatus(): FederationStatus {
  const store = getStore();

  return {
    nodeId: getNodeId(),
    signingConfigured: isSigningConfigured(),
    localReceipts: store.countByOrigin("local"),
    remoteReceipts: store.countByOrigin("remote"),
    peers: getPeers()
  };
}
