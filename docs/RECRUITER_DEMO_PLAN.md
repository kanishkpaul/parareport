# Recruiter demo cleanup

Owner-approved scope, 16 October 2026: keep the hackathon Next.js application
and its existing frontend design, make the demo reliable, retain local/BYOK AI,
show a small federation demo, and leave authority submission as a placeholder.
The Rust rebuild remains only on local branch `new`.

## Implemented

- Replaced stale archive directions with a runnable README and demo walkthrough.
- Labeled sample records and dashboard totals; removed the fake login form.
- Kept rules as the default and local/BYOK OpenAI-compatible inference optional.
  Persist a rules receipt before inference; surface a model fallback message.
- Added visible update/copy errors and input validation. Malformed proof uploads
  cannot close a report. New reports no longer enter a missing-follow-up state.
- Removed click-based verification and guessed location merging/coordinate copying.
- Added federation sequence cursors, later snapshot updates, schema/signature
  validation, origin-only mutation and a dashboard status/sync panel.
- Added a repeatable two-node test using disposable databases and synthetic AI.
- Updated existing dependencies. The frontend CSS and layout remain unchanged;
  no design kit, framework, or runtime package was added.

## Deliberately limited

Anonymous counters and completion labels remain demo actions. There is no real
authentication, private evidence system, verified outcomes, image interpretation,
reviewed translation, native/P2P networking, or full offline browser app.
Federation uses a shared secret, not independent per-node keys; intermediate
states and deletion do not replicate. Authority drafts send nothing.

Use the [two-node guide](FEDERATION_DEMO.md) for the federation demonstration.
See [testing](TESTING.md) for verification evidence and remaining advisories.
The repository change is a portfolio cleanup, not a production-readiness claim.
