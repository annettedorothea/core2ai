---
name: guided-release
description: >-
    Guided VSIX release for api2ai and db2ai (optional core2ai tag). One checkpoint per
    turn: clean git, version bump, verify (vsix:prepare), commit, VSIX build, manual test,
    GitHub release. Use for guided release, release, release CPn, or release weiter. Never
    git commit/push/tag/gh unless the user explicitly asks. For commits: repo + message only
    (user checks in via IDE).
---

# Guided release

**Ein Flow**, unterbrechbar. Der Agent führt **höchstens einen Checkpoint** pro Antwort aus und **stoppt** danach.

**Invoke:** `guided release`, `release`, `release CP0`, `release weiter`, `release ab CP4`.

**Repos:** `core2ai`, `../api2ai`, `../db2ai` (sibling layout). VSIX-Releases laufen **pro Consumer** (api2ai oder db2ai); beide nacheinander, wenn der User beide will.

## Hard rules

1. **No automatic git** — never `git commit`, `git push`, `git tag`, or `gh release` unless the user explicitly asks.
2. **User commits in the IDE** — at commit CPs, output only **repo** + **commit message** (+ optional one-line note). No `git add` lists.
3. **One checkpoint per turn** — status table with `[x]` / `[ ]`; wait for `release weiter` or manual test OK.
4. **Agent may run** `npm run …` — not git.
5. **Version before VSIX** — bump and **push** consumer version **before** `vsix:build` (VSIX filename = committed version).
6. **`.vsix` is local** — not committed; GitHub upload only via `vsix:release` after manual preview.
7. **Verify once after bump** — `npm run vsix:prepare` after `vsix:version` replaces a separate `generate:all` / `check` / `npm test` pass (those steps are already inside `vsix:prepare`).
8. **core2ai pin sync** — after any **core2ai** version bump, run `npm run sync:core2ai-pin` in **api2ai** and **db2ai** (updates `packages/cli` + `package-lock.json`). CI needs pin === sibling `../core2ai` version; mismatch → `npm ci` 404 on registry.

## Checkpoint map

| CP    | Name                            | Who   |
| ----- | ------------------------------- | ----- |
| **0** | Clean git (three repos)         | Agent |
| **C** | core2ai bump + consumer pin sync (when core changes) | Agent |
| **1** | Consumer VSIX version bump      | Agent |
| **2** | Verify pipeline (`vsix:prepare`) | Agent |
| **3** | Commit + push                   | User  |
| **4** | VSIX build                      | Agent |
| **5** | Manual preview                  | User  |
| **6** | GitHub release (`vsix:release`) | User  |

**CP C** is required whenever **core2ai** `package.json` version changes (codegen release or coordinated minor). Skip only if core2ai version is already synced in both consumers.

---

## CP0 — Clean git

Agent: `git status` in **core2ai**, **api2ai**, **db2ai**.

- **Stop** if dirty before release work — **repo + commit message** per repo (IDE).
- **Exception:** after **CP1–CP2** until **CP3** push, the releasing consumer may stay dirty (version bump ± regenerated demos from `vsix:prepare`) — expected.

→ **CP C** (if core2ai bump needed) or **CP1**

---

## CP C — core2ai version + consumer pin sync

When **core2ai** gets a new library version (especially `src/codegen/**` or coordinated release):

### 1. Bump core2ai

From **core2ai** root:

```bash
npm run version -- X.Y.Z
npm run build && npm run check
```

User commit + push (or tag) **core2ai** separately.

### 2. Sync pin in both consumers

`@core2ai/core` is **not** on npm. Local dev uses **npm link**; CI checks out sibling `../core2ai` and `package-lock.json` links there. The semver in `packages/cli/package.json` **must match** `core2ai/package.json` exactly.

From **api2ai** root, then **db2ai** root:

```bash
npm run sync:core2ai-pin
```

This runs `scripts/sync-core2ai-pin.mjs` (reads `../core2ai/package.json`) and `npm install` (refreshes lockfile `../core2ai` link entry).

Confirm:

- `packages/cli/package.json` → `"@core2ai/core": "X.Y.Z"`
- `package-lock.json` → `"../core2ai"` version `X.Y.Z`, `"link": true`

**Do not** use `file:../../../core2ai` in `package.json` — keep semver pin + lockfile link.

Include pin + lockfile in the **next consumer commit** (CP3), even when only core2ai changed and no VSIX ships yet — otherwise CI breaks on the other consumer too.

**End CP C:** stop → **CP1** (or **CP2** if consumer version already bumped).

---

## CP1 — Consumer VSIX version bump

Ask target **VSIX version** (`X.Y.Z`) — do not guess. VSIX version may differ from **core2ai** library version; if both ship together, they are often the same tag (e.g. `0.1.0`).

From the **releasing consumer** root:

```bash
npm run vsix:version -- X.Y.Z
```

Updates root + `packages/cli`, `packages/language`, `packages/extension` `package.json` (workspace semver only — **not** `@core2ai/core` pin; use **CP C** for that).

Do **not** use `npm version` or single-file edits — misaligns VSIX filename vs package versions.

Confirm all four consumer workspace `package.json` files show the same `X.Y.Z`.

If core2ai was bumped in **CP C** and pin not yet synced: run `npm run sync:core2ai-pin` here before **CP2**.

**End CP1:** stop → **CP2**.

---

## CP2 — Verify pipeline

Agent runs in the **releasing consumer** (api2ai or db2ai):

1. If **core2ai** `src/codegen/**` changed: `npm run build && npm run check` in **core2ai** (or confirm `npm run watch` was running) — optional prelude if not done in **CP C**.
2. From consumer root: **`npm run vsix:prepare`** — runs `langium:generate`, `build`, `install:demos`, `generate:all`, `build:generated` (demos), `check`, and workspace tests (language, cli, demos). Does **not** package a VSIX.

Manual equivalent (same order as `packages/extension/scripts/vsix-prepare.mjs`):

```bash
npm run langium:generate && npm run build
npm run install:demos
npm run generate:all
npm run build:generated --prefix packages/extension/demos
npm run check
npm run test --workspace packages/language
npm run test --workspace packages/cli
npm run test --prefix packages/extension/demos
```

**Not enough before `vsix:build`:** `npm run build --workspace packages/extension` alone — missing regenerate, demos JS, check, and tests.

**Do not** re-run `generate:all` / `check` / `npm test` after a green `vsix:prepare` unless you skipped CP2 or changed DSL/generator between CP2 and CP3.

**End CP2:** stop if red; else → **CP3**.

---

## CP3 — Commit + push (user)

**One commit** per repo — feature/fix changes, version bumps, pin sync, and any regenerated `generated/**/*.ts` from `vsix:prepare`, then **push**.

| Repo      | Message (example)                              |
| --------- | ---------------------------------------------- |
| `core2ai` | `Release v0.1.0: <codegen / library change>`   |
| `api2ai`  | `Release v0.1.0: <one line why>`               |
| `db2ai`   | `Release v0.1.0: <one line why>`               |

Pin-only follow-up (no VSIX): `Sync @core2ai/core pin to v0.1.0 for CI`

**End CP3:** repos clean and pushed → **CP4**.

---

## CP4 — VSIX build

From consumer root:

```bash
npm run vsix:build
```

Output (local, not committed): `packages/extension/vscode-api2ai-X.Y.Z.vsix` or `vscode-db2ai-X.Y.Z.vsix`.

**End CP4:** stop → **CP5**.

---

## CP5 — Manual preview (user)

1. Install the **`.vsix`** from CP4; reload window.
2. Extension Dev Host or copied demo workspace: **`npm run init`**, enable MCP, smoke-test tools.
3. **db2ai:** Docker required for DB demos.
4. Optional: repeat `npm run vsix:prepare` only if something failed in preview and you fixed it — then new commit before rebuilding VSIX.

**End CP5:** stop until OK → **CP6** or done.

---

## CP6 — GitHub release (user, optional)

Only after **CP5** OK — publish the **same VSIX** you tested.

From consumer root:

```bash
npm run vsix:release
```

Runs `gh release create` (prerelease) for `vscode-*-X.Y.Z.vsix`. No rebuild.

Repeat **CP0–CP6** for the other consumer if both extensions ship.

---

## Resume

| User says        | Agent does              |
| ---------------- | ----------------------- |
| `guided release` | CP0 → CP C or CP1       |
| `release CP2`    | CP2 `vsix:prepare` only  |
| `release CP1`    | CP1 version bump only    |
| `release CP4`    | CP4 VSIX only            |
| `release weiter` | Next open CP             |

---

## Troubleshooting

| Problem                         | Action                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| VSIX wrong version in filename  | **CP1** bump, **CP3** commit, **CP4** rebuild                    |
| `vsix:release` missing file     | Run **CP4** (`vsix:build`) first                                 |
| Prepare fails after bump        | Fix code/generator; version in package.json may stay — re-run CP2 |
| MCP broken after core2ai change | Rebuild core2ai (`watch`/`build`), **CP2** again, restart MCP    |
| Check fails on generated output | Fix generator or DSL — never hand-edit `generated/**` (see rules) |
| CI `npm ci` 404 `@core2ai/core` | Pin stale vs `../core2ai` — **CP C** `sync:core2ai-pin` in both consumers, commit lockfiles |

## Reference

- Build/link: [`.cursor/rules/core2ai-build.mdc`](../../.cursor/rules/core2ai-build.mdc)
- core2ai library version: `npm run version -- X.Y.Z` → `scripts/bump-version.mjs`
- Consumer pin sync: `npm run sync:core2ai-pin` → `scripts/sync-core2ai-pin.mjs`
- Consumers: `vsix:version`, `vsix:prepare`, `vsix:build`, `vsix:release` in sibling api2ai/db2ai
