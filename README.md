# ParaReport: original application

This `old` branch preserves the Next.js/TypeScript application before the
community-first Rust rebuild. New development takes place on
[`main`](https://github.com/kanishkpaul/parareport/tree/main).

The preserved source revision is
[`4672e94`](https://github.com/kanishkpaul/parareport/tree/4672e94501b1259addab497470a00c71c2727c4b).
All tracked files from that revision remain unchanged except this README.
The previous README is retained in [docs/ORIGINAL_README.md](docs/ORIGINAL_README.md).
File snapshots and primary authorship are preserved. Claude coauthor trailers
were removed from commit history at the owner's request. This snapshot is a prototype, not the architecture
or readiness claim for the new product.

## What is here

- Next.js report form, public receipts, issue feed, Leaflet map and dashboard.
- SQLite persistence, photo uploads, location-token clustering and basic status updates.
- Eight Kolkata seasonal modes, deterministic analysis, local Gemma and BYOK adapters.
- Signed shared-secret federation snapshots.
- Thirty-five tests covering providers, storage, migration, signing and federation.

## Run locally

Use Node 22.13 or newer. Node 24 was used during the October 2026 audit.

```sh
npm ci
GEMMA_ENABLED=false npm run dev
```

Open http://localhost:3000. The first database open inserts 15 sample issues.
SQLite lives in `data/`; images live in `public/uploads/`. Both are untracked.

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

For local-model configuration and the original API details, read
[the preserved README](docs/ORIGINAL_README.md).

## Known limits

- Login does not authenticate. Its form submits credentials in a GET query.
- Confirmation and resolution endpoints have no authentication or participant deduplication.
- Seed examples are included in dashboard totals.
- The rules fallback relies on English keywords; language quality is unvalidated.
- Photos are stored, not interpreted by the current provider path.
- New places are not geocoded; one shared location token can merge unrelated reports.
- Hosted persistence is a placeholder.
- Federation does not propagate later status updates and can skip timestamp ties.
- The locked dependencies had unresolved advisories during the October 2026 audit.

Use this branch as a reference and for local demonstrations. Do not deploy it
as a trusted public service without addressing these limits. This archive does
not preserve untracked databases, photographs, credentials or installed models.

## Branch policy

Keep `old` as the source reference. Build the replacement on `main`; do not
merge the old application back into it. Any new commit or public contribution
must omit AI coauthor trailers, generated-by credits and agent session links.
The October 2026 history cleanup removed the existing Claude coauthor trailer;
commit hashes changed where messages or parent hashes changed.
