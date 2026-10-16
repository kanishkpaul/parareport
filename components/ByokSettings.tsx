"use client";

import { useState } from "react";
import {
  clearByokConfig,
  saveByokConfig,
  type ByokClientConfig
} from "@/lib/byokClient";

type Props = {
  value: ByokClientConfig | null;
  onChange: (config: ByokClientConfig | null) => void;
};

// Lets a hosted-mode visitor bring their own OpenAI-compatible model. The API
// key stays in this browser tab's sessionStorage and is sent only on report
// analysis requests — it is never stored server-side.
export function ByokSettings({ value, onChange }: Props) {
  const [baseUrl, setBaseUrl] = useState(value?.baseUrl ?? "");
  const [model, setModel] = useState(value?.model ?? "");
  const [apiKey, setApiKey] = useState(value?.apiKey ?? "");
  const [status, setStatus] = useState<string | null>(null);

  function save() {
    const trimmed: ByokClientConfig = {
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      apiKey: apiKey.trim()
    };

    if (!trimmed.baseUrl || !trimmed.model || !trimmed.apiKey) {
      setStatus("Enter a base URL, model name, and API key.");
      return;
    }

    try {
      const url = new URL(trimmed.baseUrl);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error("Use an HTTP or HTTPS endpoint.");
      saveByokConfig(trimmed); onChange(trimmed);
      setStatus("Saved for this browser tab. Reports will use your model.");
    } catch { setStatus("Could not save. Use a valid HTTP(S) endpoint and allow session storage."); }
  }

  function clear() {
    try { clearByokConfig(); }
    catch { setStatus("Browser storage is unavailable. Reload to reset the session."); return; }
    onChange(null);
    setBaseUrl("");
    setModel("");
    setApiKey("");
    setStatus("Cleared. Reports will use the node's default engine.");
  }

  return (
    <details className="byok-settings" open={Boolean(value)}>
      <summary>
        Bring your own model {value ? "· active" : "· optional"}
      </summary>
      <p className="byok-hint">
        Use any OpenAI-compatible endpoint. Your key is kept only in this browser
        tab and sent only with your report — never saved on the server.
      </p>
      <label className="field-label" htmlFor="byok-base-url">
        Base URL
        <input
          id="byok-base-url"
          type="url"
          placeholder="https://api.example.com/v1"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
        />
      </label>
      <label className="field-label" htmlFor="byok-model">
        Model
        <input
          id="byok-model"
          type="text"
          placeholder="gpt-4o-mini"
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
      </label>
      <label className="field-label" htmlFor="byok-api-key">
        API key
        <input
          id="byok-api-key"
          type="password"
          autoComplete="off"
          placeholder="sk-..."
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </label>
      <div className="action-row">
        <button type="button" className="primary-action" onClick={save}>
          Use my model
        </button>
        <button type="button" className="quiet-action" onClick={clear}>
          Clear
        </button>
      </div>
      {status ? <p className="byok-status" role="status">{status}</p> : null}
    </details>
  );
}
