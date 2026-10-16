# Demo verification

Use Node 24. Run from the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run demo:test
```

The unit/integration suite covers providers, SQLite migration/storage and
signed receipt exchange. Regression cases include 201 equal-timestamp reports,
newer/older snapshots, malformed envelopes, self imports, and anonymous updates
that do not change verification status.

The production demo test starts two local servers with disposable databases,
uses a controlled HTTP model stub, and checks creation, receipt exchange, status
propagation, origin-only updates, invalid modes/batches/proofs, save-before-AI,
BYOK output application and key exclusion. It requires free ports 3201–3203 and
runs after `npm run build`. No credentials, paid calls or installed model are
required. Local-model selection/fallback is tested with mocked responses.

On 16 October 2026, all 40 tests, typecheck, lint, production build, and the
two-node production smoke test passed. `git diff --check` also passed.

## Manual walkthrough

On 16 October 2026 the existing desktop UI was checked through the browser:
the labeled sample feed/map, dashboard node-status controls, and creation of a
synthetic report through to its rules receipt. Fresh screenshots are
[feed](demo-feed.png), [dashboard](demo-dashboard.png), and
[receipt](demo-report.png). CSS was not changed.
Mobile/device testing and real model quality evaluation were not performed.

## Dependency advisories

Next.js 16.4.2 and PostCSS 8.5.30 replace the affected previous versions.
Compatible transitive updates were also applied. `npm audit --omit=dev`
reported zero vulnerabilities on 16 October 2026. The remaining full-tree audit
reports five high findings in one development lint dependency chain:
`eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces`.
The root advisory is [braces nested-pattern denial of service](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
Do not treat the suggested forced downgrade of eslint-config-next to 14.x as a
safe fix for a Next.js 16 application. These findings remain unresolved; use
trusted repository input when linting. Recheck advisories when upgrading.

The old Python foundation checks belong to the separate local rebuild branch;
they are absent from this application branch. Use the commands above for this
prototype. Passing tests do not establish privacy, multilingual accuracy,
independent verification, public deployment safety, or absence of every bug.
