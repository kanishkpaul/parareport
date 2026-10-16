# Demo dependencies

The application retains its existing Next.js/React/TypeScript/SQLite stack.
No new direct runtime dependency is introduced by the demo cleanup.

| Package | Selected version | License | Purpose and alternative | Minimal demo effect |
| --- | --- | --- | --- | --- |
| next / eslint-config-next | 16.4.2 | MIT | Existing web framework and matching lint rules; replacing the framework is outside this cleanup | Required for the existing web app |
| postcss | 8.5.30 | MIT | Existing CSS processing; update its override together with the direct dependency | Build dependency retained |
| eslint | 9.39.5 | MIT | Existing lint tool; keep the supported major rather than migrating to ESLint 10 | Development only |

Regenerate package-lock.json and inspect advisories after installation. Model
weights and llama.cpp remain separately installed, optional dependencies. Local
SQLite uses Node's built-in node:sqlite; no hosted storage driver is installed.

The design kit is not installed in this branch. The owner requested preserving
the existing frontend with functional fixes only.
