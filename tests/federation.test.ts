import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.PARAREPORT_DATA_DIR = mkdtempSync(path.join(tmpdir(), "parareport-fed-"));
process.env.PARAREPORT_STORAGE = "local";
process.env.PARAREPORT_NODE_ID = "node-a";
process.env.PARAREPORT_NODE_SECRET = "shared-federation-secret";

const { getStore } = await import("@/lib/storage");
const { buildFeed, importEnvelopes: importBatch, syncWithPeers, getFederationStatus } = await import(
  "@/lib/federation/service"
);
const { createEnvelope } = await import("@/lib/federation/signing");
type CivicIssue = import("@/types/civic").CivicIssue;

const store = getStore();
const realFetch = globalThis.fetch;

// Samples are excluded by the feed itself, without a timestamp cutoff.
const CURSOR = undefined;
function importEnvelopes(envelopes: unknown[]) {
  const previous = process.env.PARAREPORT_NODE_ID;
  process.env.PARAREPORT_NODE_ID = "receiver";
  try { return importBatch(envelopes); }
  finally { process.env.PARAREPORT_NODE_ID = previous; }
}
let counter = 0;

function insertLocal(overrides: Partial<CivicIssue> = {}): CivicIssue {
  counter += 1;
  const id = overrides.id ?? `issue-fed-${counter}`;
  const createdAt = overrides.createdAt ?? new Date(Date.UTC(2028, 0, counter, 0, 0, 0)).toISOString();
  const issue: CivicIssue = {
    id,
    title: "Fed issue",
    rawText: "SENSITIVE raw citizen text that must never federate",
    cleanSummary: "Public evidence summary.",
    mode: "monsoon_flood_dengue",
    category: "Waterlogging",
    subcategories: ["waterlogging"],
    severity: "high",
    riskFlags: ["waterlogging"],
    departmentSuggestions: ["Sewerage and Drainage"],
    locationText: "Ballygunge, Kolkata",
    photoUrl: "/uploads/secret-photo.jpg",
    status: "new",
    createdAt,
    updatedAt: createdAt,
    duplicateGroupId: `grp-${counter}`,
    verificationCount: 1,
    unresolvedConfirmations: 0,
    receipt: {
      issueId: id,
      publicTitle: "High waterlogging",
      evidenceSummary: "Public evidence summary.",
      severity: "high",
      mode: "monsoon_flood_dengue",
      riskFlags: ["waterlogging"],
      departmentSuggestions: ["Sewerage and Drainage"],
      citizenSafeActions: ["Avoid water"],
      volunteerActions: ["Mark hazard"],
      officialEnglishComplaint: "complaint",
      bengaliShareText: "পাড়া"
    },
    analysisEngine: "local-gemma",
    isSeed: false,
    ...overrides
  };
  store.insert(issue);
  return issue;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.PARAREPORT_PEERS;
});

test("buildFeed emits signed envelopes for local issues after the cursor", () => {
  insertLocal();
  insertLocal();

  const { envelopes, cursor } = buildFeed(CURSOR);
  assert.ok(envelopes.length >= 2);
  assert.ok(envelopes.every((e) => e.originNodeId === "node-a" && e.signature.length > 0));
  assert.match(cursor!, /^s:\d+$/);
});

test("federated envelopes never carry raw text or photo urls", () => {
  insertLocal();
  const { envelopes } = buildFeed(CURSOR);
  const serialized = JSON.stringify(envelopes);
  assert.ok(!serialized.includes("SENSITIVE raw citizen text"));
  assert.ok(!serialized.includes("secret-photo.jpg"));
});

test("importEnvelopes verifies, imports as remote-origin, and dedupes on repeat", () => {
  insertLocal();
  const { envelopes } = buildFeed(CURSOR);

  const first = importEnvelopes(envelopes);
  assert.ok(first.imported >= 1);
  assert.equal(first.rejected, 0);

  // Imported issues are marked remote-origin with a namespaced id.
  const sample = envelopes[0];
  const importedId = `fed:${sample.originNodeId}:${sample.payload.originIssueId}`;
  const importedIssue = store.get(importedId);
  assert.ok(importedIssue);
  assert.equal(importedIssue?.originNodeId, "node-a");
  assert.equal(importedIssue?.originIssueId, sample.payload.originIssueId);

  const second = importEnvelopes(envelopes);
  assert.equal(second.imported, 0);
  assert.equal(second.rejected, 0);
});

test("tampered envelopes are rejected on import", () => {
  insertLocal();
  const { envelopes } = buildFeed(CURSOR);
  const tampered = envelopes.map((e) => ({
    ...e,
    payload: { ...e.payload, severity: "critical" as const }
  }));

  const result = importEnvelopes(tampered);
  assert.equal(result.imported, 0);
  assert.equal(result.rejected, tampered.length);
});

test("bidirectional provenance: issues from two peers coexist", () => {
  insertLocal();
  const { envelopes } = buildFeed(CURSOR);

  // node-a's own feed imported here (as if received by another node).
  importEnvelopes(envelopes);

  // A receipt authored by node-b arrives and is signed with the shared secret.
  // A receipt authored by node-b, re-signed under node-b's identity.
  const bEnvelopes = envelopes.map((e) =>
    createEnvelope(
      "node-b",
      { ...e.payload, originIssueId: `b-${e.payload.originIssueId}` },
      "shared-federation-secret"
    )
  );

  const result = importEnvelopes(bEnvelopes);
  assert.ok(result.imported >= 1);
  assert.equal(store.countByOrigin("remote") >= 2, true);
});

test("syncWithPeers tolerates an offline peer without throwing", async () => {
  process.env.PARAREPORT_PEERS = "https://offline.example";
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;

  const statuses = await syncWithPeers();
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].reachable, false);
  assert.ok(statuses[0].error);

  // Local reporting is unaffected by the peer outage.
  const before = store.countByOrigin("local");
  insertLocal();
  assert.equal(store.countByOrigin("local"), before + 1);
});

test("syncWithPeers imports envelopes from a reachable peer and advances the cursor", async () => {
  process.env.PARAREPORT_PEERS = "https://peer.example";
  insertLocal({ id: "issue-peer-src" });
  const { envelopes } = buildFeed(CURSOR);
  const peerBatch = envelopes.filter((e) => e.payload.originIssueId === "issue-peer-src");

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ nodeId: "node-a", envelopes: peerBatch, cursor: "s:999" }), { status: 200 })) as typeof fetch;

  process.env.PARAREPORT_NODE_ID = "receiver";
  const statuses = await syncWithPeers();
  process.env.PARAREPORT_NODE_ID = "node-a";
  assert.equal(statuses[0].reachable, true);
  assert.ok(store.get("fed:node-a:issue-peer-src"));
  assert.ok(store.getPeerCursor("https://peer.example"));
});

test("getFederationStatus reports signing config and receipt counts", () => {
  insertLocal();
  const status = getFederationStatus();
  assert.equal(status.nodeId, "node-a");
  assert.equal(status.signingConfigured, true);
  assert.ok(status.localReceipts > 0);
});

test("sequence pagination retains all reports sharing a timestamp", () => {
  const baseline = buildFeed(undefined).cursor;
  for (let i = 0; i < 201; i++) insertLocal({ createdAt: "2029-01-01T00:00:00.000Z" });
  const first = buildFeed(baseline);
  const second = buildFeed(first.cursor);
  assert.equal(first.envelopes.length, 200);
  assert.equal(second.envelopes.length, 1);
  assert.equal(new Set([...first.envelopes, ...second.envelopes].map(e => e.payload.originIssueId)).size, 201);
});

test("later local status changes propagate and older snapshots cannot revert them", () => {
  const issue = insertLocal();
  const first = buildFeed(undefined, 200);
  const old = createEnvelope("node-a", payloadFor(issue), "shared-federation-secret");
  importEnvelopes([old]);
  store.markFixed(issue.id);
  const updated = store.get(issue.id)!;
  const current = createEnvelope("node-a", payloadFor(updated), "shared-federation-secret");
  assert.equal(importEnvelopes([current]).imported, 1);
  assert.equal(importEnvelopes([old]).imported, 0);
  assert.equal(store.get(`fed:node-a:${issue.id}`)?.status, "fixed");
  assert.ok(store.localIssuesSince(first.cursor, 200).some(change => change.issue.id === issue.id));
});

function payloadFor(issue: CivicIssue) {
  return { originIssueId: issue.id, createdAt: issue.createdAt, updatedAt: issue.updatedAt,
    mode: issue.mode, category: issue.category, severity: issue.severity, status: issue.status,
    locationText: issue.locationText, verificationCount: issue.verificationCount,
    unresolvedConfirmations: issue.unresolvedConfirmations, analysisEngine: issue.analysisEngine,
    receipt: issue.receipt };
}

test("signed malformed payloads, invalid hex and self imports are rejected", () => {
  const issue = insertLocal();
  const envelope = createEnvelope("node-a", payloadFor(issue), "shared-federation-secret");
  assert.equal(importBatch([envelope]).rejected, 1);
  assert.equal(importEnvelopes([{ ...envelope, signature: envelope.signature + "ZZ" }]).rejected, 1);
  const invalid = createEnvelope("peer-b", { ...payloadFor(issue), receipt: {} } as typeof envelope.payload, "shared-federation-secret");
  assert.equal(importEnvelopes([invalid]).rejected, 1);
});

test("enum arrays cannot pass the peer schema boundary", () => {
  const issue = insertLocal();
  const invalid = createEnvelope("peer-b", { ...payloadFor(issue), mode: ["everyday"] } as unknown as ReturnType<typeof payloadFor>, "shared-federation-secret");
  assert.equal(importEnvelopes([invalid]).rejected, 1);
});
