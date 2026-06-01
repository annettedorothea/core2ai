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

## Checkpoint map

| CP    | Name                            | Who   |
| ----- | ------------------------------- | ----- |
| **0** | Clean git (three repos)         | Agent |
| **1** | Version bump                    | Agent |
| **2** | Verify pipeline (`vsix:prepare`) | Agent |
| **3** | Commit + push                   | User  |
| **4** | VSIX build                      | Agent |
| **5** | Manual preview                  | User  |
| **6** | GitHub release (`vsix:release`) | User  |

Optional **core2ai library tag** (only if `src/codegen/**` changed since last tag): bump with `npm run version -- X.Y.Z`, `npm run build && npm run check` in **core2ai**, user commit + tag — before consumer **CP1** (dev uses **npm link**, no consumer pin step).

---

## CP0 — Clean git

Agent: `git status` in **core2ai**, **api2ai**, **db2ai**.

- **Stop** if dirty before release work — **repo + commit message** per repo (IDE).
- **Exception:** after **CP1–CP2** until **CP3** push, the releasing consumer may stay dirty (version bump ± regenerated demos from `vsix:prepare`) — expected.

→ **CP1**

---

## CP1 — Version bump

Ask target **VSIX version** (`X.Y.Z`) — do not guess.

From the **releasing consumer** root:

```bash
npm run vsix:version -- X.Y.Z
```

Updates root + `packages/cli`, `packages/language`, `packages/extension` `package.json`.

Do **not** use `npm version` or single-file edits — misaligns VSIX filename vs package versions.

Confirm all four consumer `package.json` files show the same `X.Y.Z`.

**End CP1:** stop → **CP2**.

---

## CP2 — Verify pipeline

Agent runs in the **releasing consumer** (api2ai or db2ai):

1. If **core2ai** `src/codegen/**` changed since last tag: `npm run build && npm run check` in **core2ai** (or confirm `npm run watch` was running) — optional prelude, not a VSIX step.
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

**One commit** in the releasing consumer — feature/fix changes, version bump, and any regenerated `generated/**/*.ts` from `vsix:prepare`, then **push**.

| Repo     | Message (example)                |
| -------- | -------------------------------- |
| `api2ai` | `Release v0.0.5: <one line why>` |
| `db2ai`  | `Release v0.0.5: <one line why>` |

If **core2ai** was tagged in the optional prelude, that is a **separate** commit on **core2ai**.

**End CP3:** consumer clean and pushed → **CP4**.

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
| `guided release` | CP0 → CP1                |
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

## Reference

- Build/link: [`.cursor/rules/core2ai-build.mdc`](../../.cursor/rules/core2ai-build.mdc)
- core2ai tag only: `npm run version -- X.Y.Z` → `scripts/bump-version.mjs`
- Consumers: `vsix:version`, `vsix:prepare`, `vsix:build`, `vsix:release` in sibling api2ai/db2ai
