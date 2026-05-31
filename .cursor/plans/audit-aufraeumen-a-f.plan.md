# Audit-Aufräumen A–F

Systematische Abarbeitung über **core2ai**, **api2ai**, **db2ai**. Pro Block: verifizieren → ändern → `npm run check` / `npm test` → nächster Block.

**Stand:** Audit **abgeschlossen** (Mai 2026). Offene Punkte unten nur noch als **wontfix** / bewusst unverändert dokumentiert.

---

## Block A — api2ai ↔ db2ai: strukturelle Inkonsistenzen

### A1 Tests & CLI

| # | Status | Thema |
|---|--------|--------|
| A1.1 | **done** | db2ai `document-actions.test.ts` (wie api2ai) |
| A1.2 | → **Block D** | `asRecord` / `restoreEnv` nach `@core2ai/core/test-helpers` (**done**) |
| A1.3 | **done** | api2ai `vitest.config.ts`: `tmp/**` in exclude |
| A1.4 | **done** | `access-demo-direct-invoke.test.ts`; Tests unter `packages/extension/demos/test/` |
| A1.5 | **wontfix** | Sakila MCP stdio — bewusst weggelassen |

### A2 Extension & Demos — **done**

- Command-Titel `.mjs` → `.ts`/MCP host (**done**)
- READMEs `mcp-serve.mjs` → `.js` (**done**)
- db2ai `.vscodeignore`: `langium-quickstart.md` entfernen (**done**)

### A3 Root-README — **done**

| # | Status | Thema |
|---|--------|--------|
| A3.1 | **done** | Getting started: Workflow-Tabelle wie api2ai |
| A3.2 | **done** | Daily scripts: `watch`, `check`-Text (`format:check` + `typecheck` + `lint`) |
| A3.3 | **done** | Demos-Zeile, Project layout `demos/`, Docs-Links (core2ai Layer 1–3) |
| A3.4 | **done** | Launch: Links zu [`tasks.json`](../db2ai/.vscode/tasks.json) + `mcp-dsl.code-workspace` |

### A4 Guided-release Skills — **done**

- core2ai + db2ai SKILL: `npm test` statt `test:unit` / `test:smoke` (**done**; api2ai war schon aktuell)

### A5 Kleinkram — **done**

- api2ai: `esbuild` aus CLI devDependencies (**done**)
- leere `test/smoke`/`test/e2e` (**bereits entfernt**)
- main.ts TODO (**done** — an db2ai angeglichen)

---

## Block B — Toter Code — **done**

| # | Status | Thema |
|---|--------|--------|
| B1 | **done** | `consumer-dev-smoke.mjs` gelöscht |
| B2 | **done** | leerer `src/mcp-host/` entfernt |
| B3 | **done** | `core2ai/README.md` + `package.json` `files` ohne `scripts/` |
| B4 | **wontfix** | `access-demo-docker.ts` — in Vitest genutzt, behalten |

---

## Block C — Veraltete Texte — **done**

| # | Status | Thema |
|---|--------|--------|
| C1 | **done** | api2ai `generate:all` + `build:generated` (ohne `smoke-generated` in Fehlertexten) |
| C2 | **done** | api2ai README; db2ai `mcp-db2ai-only.mdc` (`.js` statt `.mjs`) |
| C3 | **done** | db2ai demos-README „Verify“ → `npm test --prefix …/demos` |

---

## Block D — Shared test helpers & Duplikate

### D1 Test helpers in core2ai (A1.2)

| # | Status | Inhalt |
|---|--------|--------|
| D1.1 | **done** | `@core2ai/core/test-helpers`: `asRecord`, `restoreEnv` in [`src/test-helpers/index.ts`](../src/test-helpers/index.ts) |
| D1.2 | **done** | api2ai `mock-api-direct-invoke.test.ts` importiert von core2ai |
| D1.3 | **done** | db2ai `direct-invoke.ts` importiert/re-exportiert; `test/support/env.ts` gelöscht |

### D2 Weitere Duplikate

| Datei | Status |
| ----- | ------ |
| `generated-module.ts` | **done** → `@core2ai/core/test-fixtures` |
| `mcp-stdio-smoke.ts` | **done** → `@core2ai/core/test-fixtures` |
| `compile-generated-fixture.ts` | **done** → `@core2ai/core/test-fixtures` (workspace root aus `runRoot`) |
| `demo-bundle-required.json` + `verify-demos-bundle.mjs` | **wontfix** — pro Extension/VSIX-Build; Script + JSON bleiben lokal |
| `render-bootstrap.ts`, `render-mcp-serve.ts` (Consumer) | **wontfix** — dünne Delegation auf `@core2ai/core/codegen`, bewusst behalten |

---

## Block E — Bewusst unterschiedlich — **wontfix**

- HTTP vs SQL Generator, Docker-Tests nur db2ai, `json-schema-to-zod` nur api2ai, db2ai `cli/src/env.ts`
- Keine Angleichung nötig; optionaler docs-Absatz nicht umgesetzt (bewusst)

---

## Block F — Priorisierte Reihenfolge — **done**

Alle Punkte F1–F8 erledigt oder als wontfix markiert (A1.5 Sakila MCP stdio, B4 access-demo-docker, D2 Extension-Wrapper, E docs).

**Verify:** core2ai `npm run build && npm run check`; Consumer `npm test`.

---

#Col3:23
