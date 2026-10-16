import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as pause } from "node:timers/promises";

const root = await mkdtemp(path.join(tmpdir(), "parareport-demo-"));
const children = [];
const a = "http://127.0.0.1:3201";
const b = "http://127.0.0.1:3202";
const secret = "synthetic-demo-test-secret";
let model;
let releaseModel;

async function start(port, id, peer) {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", PARAREPORT_DATA_DIR: path.join(root, id),
      PARAREPORT_SEED: "false", GEMMA_ENABLED: "false", PARAREPORT_NODE_ID: id,
      PARAREPORT_NODE_SECRET: secret, PARAREPORT_PEERS: peer }, stdio: ["ignore", "pipe", "pipe"]
  });
  children.push(child);
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(output);
    if (output.includes("Ready")) {
      try { if ((await fetch(`http://127.0.0.1:${port}/api/federation/status`)).ok) return; } catch { /* Server may still be binding. */ }
    }
    await pause(100);
  }
  throw new Error(`Server startup timed out: ${output}`);
}
async function post(base, route, body, headers = {}) {
  return fetch(base + route, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}
try {
  await start(3201, "node-a", b);
  await start(3202, "node-b", a);
  let response = await post(a, "/api/reports", { text: "Synthetic blocked drain", location: "Demo north lane", mode: "everyday" });
  assert.equal(response.status, 201);
  const { issue } = await response.json();
  assert.equal(issue.analysisEngine, "rules");
  assert.equal(issue.lat, undefined);
  const remoteId = `fed:node-a:${issue.id}`;
  await post(b, "/api/federation/sync", {});
  response = await fetch(b + `/api/reports/${remoteId}`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).issue.originNodeId, "node-a");
  await post(a, `/api/reports/${issue.id}/confirm`, {});
  await post(a, `/api/reports/${issue.id}/confirm`, {});
  assert.equal((await (await fetch(a + `/api/reports/${issue.id}`)).json()).issue.verificationCount, 0);
  response = await fetch(a + `/api/reports/${issue.id}/resolve`, { method: "POST", headers: { "content-type": "multipart/form-data; boundary=bad" }, body: "broken" });
  assert.equal(response.status, 400);
  assert.equal((await (await fetch(a + `/api/reports/${issue.id}`)).json()).issue.status, "new");
  await post(a, `/api/reports/${issue.id}/resolve`, {});
  await post(b, "/api/federation/sync", {});
  assert.equal((await (await fetch(b + `/api/reports/${remoteId}`)).json()).issue.status, "fixed");
  assert.equal((await post(b, `/api/reports/${remoteId}/confirm`, {})).status, 409);
  assert.equal((await post(a, "/api/reports", { text: "test", mode: "invalid" })).status, 400);
  assert.equal((await post(a, "/api/federation/receipts", { envelopes: "bad" })).status, 400);
  let arrived;
  const waiting = new Promise(resolve => { arrived = resolve; });
  model = createServer((req, res) => {
    assert.equal(req.headers.authorization, "Bearer synthetic-key");
    releaseModel = () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ mode: "everyday", severity: "medium", category: "Demo model classification", cleanSummary: "Synthetic model summary" }) } }] }));
    };
    arrived();
  });
  await new Promise(resolve => model.listen(3203, "127.0.0.1", resolve));
  const pending = post(a, "/api/reports", { text: "Synthetic delayed inference", mode: "everyday" }, {
    "x-parareport-model-base-url": "http://127.0.0.1:3203/v1", "x-parareport-model": "synthetic",
    "x-parareport-api-key": "synthetic-key"
  });
  await Promise.race([waiting, pause(5000).then(() => { throw new Error("Model stub not called"); })]);
  assert.ok((await (await fetch(a + "/api/reports")).json()).issues.some(record => record.rawText === "Synthetic delayed inference"));
  releaseModel();
  releaseModel = undefined;
  const analyzed = await (await pending).json();
  assert.equal(analyzed.analysisEngine, "byok");
  assert.equal(analyzed.issue.category, "Demo model classification");
  const serialized = JSON.stringify(await (await fetch(a + "/api/federation/receipts")).json());
  assert.ok(!serialized.includes("synthetic-key"));
  console.log("PASS: two-node receipt exchange, later updates, origin protection, validation, save-before-AI and BYOK compatibility.");
} finally {
  if (releaseModel) releaseModel();
  if (model) { model.closeAllConnections(); await new Promise(resolve => model.close(resolve)); }
  await Promise.all(children.map(child => new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once("exit", resolve); child.kill("SIGTERM"); })));
  await rm(root, { recursive: true, force: true });
}
