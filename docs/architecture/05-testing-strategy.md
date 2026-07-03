# Testing strategy

[← Documentation index](../README.md)

How **api2ai**, **db2ai**, and **core2ai** are tested — and what is intentionally manual.

## Contents

- [Three gates](#three-gates)
- [What `npm test` covers](#what-npm-test-covers)
- [What `/test-all` covers (manual)](#what-test-all-covers-manual)
- [Setup after clone](#setup-after-clone)
- [Not in automated tests](#not-in-automated-tests)
- [Release checklist](#release-checklist)

---

## Three gates

| Gate           | Command                                                          | What runs                                                     |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| **pre-commit** | `npm run check && npm run test`                                  | format, typecheck, lint; language + CLI + demos compile tests |
| **CI**         | `langium:generate` → `build` → `generate:all` → `check` → `test` | same tests as pre-commit, plus full generate pipeline         |
| **Release**    | `vsix:prepare` → VSIX → demo workspace → `/test-all`             | all MCP servers and tools in Cursor (manual)                  |

There is **no** separate `test:integration` script. MCP/runtime coverage is **not** duplicated in CI.

---

## What `npm test` covers

| Package                    | Tests                                                                | Role                                                       |
| -------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/language`        | parsing, validating, completions, linking; db2ai SQL + EXPLAIN mocks | LSP / DSL logic (same code the editor uses)                |
| `packages/cli`             | document-actions; invoke-render / zod-codegen                        | Generator gates                                            |
| `packages/extension/demos` | `compile-generated.test.ts`                                          | `npm run build:generated` on committed `generated/**/*.ts` |
| `core2ai`                  | codegen snapshots                                                    | MCP host template regression                               |

---

## What `/test-all` covers (manual)

- Every MCP server in `.cursor/mcp.json`
- Every tool via schema-only agent calls
- OAuth sign-in, HTTP relays, stdio hosts, all demos

Use before each release. Skill: `api2ai-test-all-mcp` / `db2ai-test-all-mcp`.

---

## Setup after clone

From **api2ai** or **db2ai** repo root:

```bash
npm ci
npm run install:demos   # once — demos/ has its own node_modules (TypeScript, vitest, zod, …)
npm run build
```

`npm test` in demos resolves `typescript` from `packages/extension/demos/node_modules`.

---

## pre-commit notes

- `check` runs typecheck (noEmit); `test` runs `tsc -b` (emit) so CLI tests can load `out/`.
- `langium:generate` is **not** in pre-commit — run it after grammar changes; CI runs it on push.

---

## Not in automated tests

- VS Code extension UI (generate-on-save wiring, diagnostics display)
- End-to-end MCP protocol in CI (replaced by `/test-all`)
- Live database EXPLAIN (db2ai uses mocked driver probes in unit tests)

---

## Release checklist

```text
vsix:prepare → vsix:build → VSIX install → Create demo workspace → npm install && npm run start → /test-all
```

---

## See also

- [MCP Inspector](../testing/mcp-inspector.md)
- [CHANGELOG policy](../development/changelog-policy.md)
- [Documentation index](../README.md)

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
