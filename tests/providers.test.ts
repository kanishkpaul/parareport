import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { analyzeReport } from "@/lib/providers";
import { readByokConfig, BYOK_HEADERS } from "@/lib/providers/byok";
import { byokHeaders } from "@/lib/byokClient";
import type { AnalyzeIssueInput, AnalyzeIssueOutput } from "@/types/civic";

const input: AnalyzeIssueInput = {
  text: "School gate drain jammed, water logged, mosquitoes",
  date: "2026-07-05T06:00:00.000Z",
  approximateLocation: "Ballygunge, Kolkata"
};

const modelOutput: Partial<AnalyzeIssueOutput> = {
  mode: "monsoon_flood_dengue",
  category: "Waterlogging and drainage hazard",
  severity: "high",
  riskFlags: ["waterlogging", "dengue risk"],
  cleanSummary: "Waterlogging near the school gate.",
  officialEnglishComplaint: "To the concerned department...",
  bengaliShareText: "পাড়া সতর্কতা",
  departmentSuggestions: ["Sewerage and Drainage"],
  subcategories: ["waterlogging"],
  volunteerActions: ["Mark hazard"],
  citizenSafeActions: ["Avoid water"]
};

const realFetch = globalThis.fetch;
let calls: Array<{ url: string; init: RequestInit | undefined }> = [];

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  calls = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url.toString();
    calls.push({ url: href, init });
    return handler(href, init);
  }) as typeof fetch;
}

function okModelResponse() {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(modelOutput) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GEMMA_ENABLED;
});

test("BYOK request succeeds and reports the byok engine", async () => {
  mockFetch(() => okModelResponse());

  const result = await analyzeReport(input, {
    byok: { baseUrl: "https://api.example.com/v1", model: "gpt-4o-mini", apiKey: "sk-secret" }
  });

  assert.equal(result.engine, "byok");
  assert.equal(result.output.mode, "monsoon_flood_dengue");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.com/v1/chat/completions");

  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get("authorization"), "Bearer sk-secret");
});

test("BYOK failure falls back to the rules engine, not local gemma", async () => {
  mockFetch(() => new Response("boom", { status: 500 }));

  const result = await analyzeReport(input, {
    byok: { baseUrl: "https://api.example.com/v1", model: "gpt-4o-mini", apiKey: "sk-secret" }
  });

  assert.equal(result.engine, "rules");
  // Only the BYOK endpoint was attempted; no silent fallthrough to local gemma.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.com/v1/chat/completions");
});

test("local gemma is used when explicitly enabled", async () => {
  process.env.GEMMA_ENABLED = "true";
  mockFetch(() => okModelResponse());

  const result = await analyzeReport(input, {});

  assert.equal(result.engine, "local-gemma");
  const headers = new Headers(calls[0].init?.headers);
  // Local gemma via llama.cpp needs no auth header.
  assert.equal(headers.get("authorization"), null);
});

test("local gemma failure falls back to rules", async () => {
  process.env.GEMMA_ENABLED = "true";
  mockFetch(() => {
    throw new Error("connection refused");
  });

  const result = await analyzeReport(input, {});
  assert.equal(result.engine, "rules");
  // The deterministic rules classifier still produces a complete result.
  assert.ok(result.output.category.length > 0);
  assert.ok(result.output.cleanSummary.length > 0);
});

test("GEMMA_ENABLED=false uses rules without any network call", async () => {
  process.env.GEMMA_ENABLED = "false";
  mockFetch(() => okModelResponse());

  const result = await analyzeReport(input, {});
  assert.equal(result.engine, "rules");
  assert.equal(calls.length, 0);
});

test("readByokConfig extracts a complete config from headers", () => {
  const headers = new Headers({
    [BYOK_HEADERS.baseUrl]: "https://api.example.com/v1",
    [BYOK_HEADERS.model]: "gpt-4o-mini",
    [BYOK_HEADERS.apiKey]: "sk-secret"
  });

  const config = readByokConfig(headers);
  assert.deepEqual(config, {
    baseUrl: "https://api.example.com/v1",
    model: "gpt-4o-mini",
    apiKey: "sk-secret"
  });
});

test("readByokConfig returns undefined when any field is missing", () => {
  const headers = new Headers({
    [BYOK_HEADERS.baseUrl]: "https://api.example.com/v1",
    [BYOK_HEADERS.model]: "gpt-4o-mini"
  });
  assert.equal(readByokConfig(headers), undefined);
});

test("readByokConfig rejects non-http(s) base URLs", () => {
  const headers = new Headers({
    [BYOK_HEADERS.baseUrl]: "file:///etc/passwd",
    [BYOK_HEADERS.model]: "gpt-4o-mini",
    [BYOK_HEADERS.apiKey]: "sk-secret"
  });
  assert.equal(readByokConfig(headers), undefined);
});

test("byokHeaders only emits the three BYOK headers and nothing when unset", () => {
  assert.deepEqual(byokHeaders(null), {});

  const headers = byokHeaders({
    baseUrl: "https://api.example.com/v1",
    model: "gpt-4o-mini",
    apiKey: "sk-secret"
  });
  assert.deepEqual(Object.keys(headers).sort(), [BYOK_HEADERS.apiKey, BYOK_HEADERS.baseUrl, BYOK_HEADERS.model].sort());
});

test("default demo uses rules without contacting a model", async () => {
  delete process.env.GEMMA_ENABLED;
  mockFetch(() => { throw new Error("Default demo must not request inference"); });
  const result = await analyzeReport(input);
  assert.equal(result.engine, "rules");
  assert.equal(calls.length, 0);
});
