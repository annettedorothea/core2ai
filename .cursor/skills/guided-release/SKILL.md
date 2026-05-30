---
name: guided-release
description: >-
    Guided checkpoint release across core2ai, api2ai, and db2ai. One flow: optional @core2ai/core
    library tag, then consumer pin preview for api2ai and db2ai together (no auto-commit), VSIX
    per consumer. Stops after each checkpoint. Use for guided release, release, release CPn, or
    release weiter. Never git commit/push/tag unless the user explicitly asks. For commits: repo
    name + message only (user checks in via IDE).
---

# Guided release (checkpoint flow)

**Ein Flow**, unterbrechbar. Der Agent führt **höchstens einen Checkpoint** pro Antwort aus und **stoppt** danach.

**Invoke:** `guided release`, `release`, `release CP0`, `release weiter`, `release ab CP4`.

**Repos:** `core2ai`, `../api2ai`, `../db2ai` (sibling layout).

## Hard rules (always)

1. **No automatic git** — never run `git commit`, `git push`, `git tag`, or `gh release` unless the user explicitly asks to run a specific command.
2. **User commits in the IDE** — at commit CPs, output only:
    - **Repo** (`core2ai` | `api2ai` | `db2ai`)
    - **Commit message** (one line, copy-paste ready)
    - Optional: one short note what changed (no `git add` lists, no shell blocks for commit/push/tag).
3. **Tag / push / gh** — repo + plain words (e.g. „Tag `v0.0.5` auf `core2ai` pushen“), no long copy-paste unless the user asks.
4. **One checkpoint per turn** — after each CP, print status table; wait for `release weiter`, `release CPn`, or manual test OK.
5. **Agent may run** `npm run …` in **api2ai** and **db2ai** when a CP covers both — not git.
6. **Paired consumers:** Pin preview and the **single** consumer commit+push (CP5) always treat **api2ai + db2ai** together.
7. **One consumer commit before push (CP5):** After CP4 pin preview, agent bumps **VSIX/consumer versions** and runs `generate:all`; user commits **pin + version bump + bundle + regenerated demos** in **one commit per repo**, then **one push**. No separate „pin push“ and „version push“.
8. **Test before commit:** CP4 validates GitHub pin (`use-pin`). Pin test does not require the old VSIX version number — bumping consumer version before CP5 commit is OK.
9. **VSIX after push:** CP6/CP8 build VSIX from **committed** versions; `.vsix` is local (not committed). Preview VSIX, then optional GitHub release (CP7/CP9).
10. **Two release kinds:** Library tag (`@core2ai/core` on **core2ai**); VSIX (**api2ai** / **db2ai** `packages/extension`).

## Checkpoint map

| CP    | Name                                                                     | When                            |
| ----- | ------------------------------------------------------------------------ | ------------------------------- |
| **0** | Clean git (start)                                                        | Always first                    |
| **1** | Need core2ai library release?                                            | Library track **or** skip **4** |
| **2** | core2ai: bump + verify                                                   | Only if CP1 = yes               |
| **3** | core2ai: commit + tag (user)                                             | Only if CP1 = yes               |
| **4** | **Consumers:** pin preview (api2ai + db2ai)                              | After tag **or** CP1 skipped    |
| **5** | **Consumers:** version bump (agent) + **one commit + push** (user, both) | After CP4                       |
| **6** | api2ai: VSIX build + preview                                             | After CP5                       |
| **7** | api2ai: VSIX GitHub release (user)                                       | Optional; after CP6 OK          |
| **8** | db2ai: VSIX build + preview                                              | After CP6/7                     |
| **9** | db2ai: VSIX GitHub release (user)                                        | Optional; after CP8 OK          |

Print table with `[x]` / `[ ]` at start and after each CP.

---

## CP0 — Clean git (three repos)

Agent runs `git status` in all three repos.

- **Stop** if dirty **before** release work — **repo + commit message** per repo (IDE).
- **Exception:** after **CP4** until **CP5** push, api2ai/db2ai may stay dirty — expected.

**End CP0:** → CP1.

---

## CP1 — Library release needed?

From **core2ai**: `npm run core2ai:pin`, `scripts/core2ai-pin.json`, `git log <tag>..HEAD --oneline -- packages/ scripts/ README.md docs/`.

- **Yes** if `packages/` / `scripts/` changed since tag or user says mcp-host/codegen changed.
- **No** → skip to **CP4** (both consumers).

Ask: **Library-Release nötig?** (ja → CP2 / nein → CP4)

**End CP1:** wait for answer.

---

## CP2 — core2ai: bump + verify (no git)

Only if library = yes. Ask target `vX.Y.Z`. Bump version files + `core2ai-pin.json` (+ `CORE2AI_CODEGEN_VERSION` if present). Run `npm run build`, `test`, `check`.

**End CP2:** stop → `release CP3`.

---

## CP3 — core2ai: commit + tag (user)

After CP2 green.

| Repo      | Message                          |
| --------- | -------------------------------- |
| `core2ai` | `Release vX.Y.Z: <one line why>` |

User: push `main`, annotated tag `vX.Y.Z`, push tag. Tag on GitHub before CP4.

**End CP3:** stop.

---

## CP4 — Consumers: pin preview (api2ai + db2ai, no commit)

**Prerequisite:** tag `vX.Y.Z` on GitHub (CP3) or pin already current (CP1 skipped).

Agent runs the **same pipeline in both repos** (order: api2ai, then db2ai):

- `core2ai:use-pin`
- **api2ai only:** `install:demos`
- `langium:generate`, `build`, `bundle:mcp-runtime`, `generate:all`, `check`, `test:unit`
- Confirm no `file:` pin in either repo’s `package*.json`

### Manual preview (user — **both** required before CP5)

Test GitHub pin (`github:…/core2ai#vX.Y.Z`, not `file:…/core2ai`).

1. **MCP servers** neu starten.
2. **api2ai:** Extension Dev Host → demos — generate/save, optional smoke/MCP.
3. **db2ai:** Extension Dev Host → demos — optional Docker, smoke/MCP.

**End CP4:** stop until both OK.

Optional: `npm run core2ai:check-push-pin` in each consumer before CP5.

---

## CP5 — Consumers: version bump + one commit + push

Only after **CP4** passed for **both** repos.

### 5a — Version bump (agent, no git)

Ask target **VSIX/consumer version** per repo (`X.Y.Z`) — do not guess. api2ai and db2ai may share the same patch (e.g. `0.0.3`) or differ.

**Bump in each repo** (same new version in that repo):

| Repo       | Files                                                              |
| ---------- | ------------------------------------------------------------------ |
| **api2ai** | root + `packages/cli` + `packages/extension`                       |
| **db2ai**  | root + `packages/cli` + `packages/language` + `packages/extension` |

`packages/cli` drives `mcpServerVersion` in generated tools.

Then in **both** repos: `npm run generate:all`, `npm run check`, `npm run test:unit`.

Working tree now includes **pin (from CP4) + version bump + regenerated demos + bundle** — all intended for **one commit**.

### 5b — Commit + push (user, IDE)

**One commit per repo** — pin and VSIX version together, then **push** immediately (pre-push hook: no `file:` pin).

| Repo     | Commit message (example)                       |
| -------- | ---------------------------------------------- |
| `api2ai` | `Release v0.0.3: bump @core2ai/core to v0.0.5` |
| `db2ai`  | `Release v0.0.3: bump @core2ai/core to v0.0.5` |

Adjust version numbers to what was agreed in 5a.

If pre-push fails: `core2ai:use-pin`, `npm run check`, retry. Never push with `use-local`.

**End CP5:** both repos clean, pushed, versions on remote → CP6.

---

## CP6 — api2ai: VSIX build + preview

**Prerequisite:** CP5 pushed (versions **0.0.3** etc. already on `main`).

Agent: `npm run extension:vsix -w packages/extension` (no version bump here — already committed).

Output: `packages/extension/vscode-api2ai-X.Y.Z.vsix` (local, not committed).

### Manual preview (user)

Install from VSIX, reload, smoke extension/MCP.

**End CP6:** stop until OK → CP7 optional or CP8.

---

## CP7 — api2ai: VSIX GitHub (user, optional)

After CP6 preview OK — publish the **same VSIX** you installed and tested.

In **api2ai:** `npm run release:vsix`

Uploads `packages/extension/vscode-api2ai-X.Y.Z.vsix` via `gh release create` (prerelease). No test, check, or rebuild.

**Prerequisite:** VSIX built in CP6 and preview passed.

---

## CP8 — db2ai: VSIX build + preview

**Prerequisite:** db2ai consumer version **committed and pushed** (normally in **CP5** together with pin).

### If db2ai is still on the old version (e.g. CP5 was pin-only)

Before VSIX: run **CP5a for db2ai only** — bump root + `packages/cli` + `packages/language` + `packages/extension`, `generate:all`, `check`, `test:unit`. User **commit + push** (e.g. `Release vscode-db2ai v0.0.3`), then continue below.

### VSIX (agent, no git)

`npm run extension:vsix -w packages/extension` — **no version bump** if version already on `main`.

Manual: install VSIX, reload; Docker if needed.

**End CP8:** stop until OK → CP9 optional.

---

## CP9 — db2ai: VSIX GitHub (user, optional)

After CP8 preview OK. In **db2ai:** `npm run release:vsix` (publishes the tested `vscode-db2ai-X.Y.Z.vsix` only).

---

## Resume

| User says        | Agent does               |
| ---------------- | ------------------------ |
| `guided release` | CP0 → CP1                |
| `release CP4`    | CP4 only                 |
| `release CP5`    | CP5 (bump + commit hint) |
| `release CP6`    | CP6 VSIX api2ai only     |
| `release CP8`    | CP8 VSIX db2ai only      |
| `release weiter` | Next open CP             |

**Legacy:** `release CP6b` / `CP8b` → folded into **CP5** (single commit). If user already pushed pin-only, treat extra version commit as one-time cleanup (see Troubleshooting).

---

## Troubleshooting

| Problem                                         | Action                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `use-pin` fails                                 | Tag not on remote — finish CP3                                        |
| Pre-push / pin fail                             | `use-pin`, ensure manifests committed, `check`, push again            |
| `use-local` slipped in                          | Re-run CP4, do not push until fixed                                   |
| **Pin already pushed, db2ai version still old** | CP8: bump db2ai (CP5a files), commit+push, then `extension:vsix`      |
| VSIX wrong filename (old version)               | Version bump must happen in **CP5**, before `extension:vsix` in CP6/8 |
| Missing VSIX at publish                         | Run CP6/8 `extension:vsix` and preview before `release:vsix`          |
| Only one consumer OK                            | Do not advance past CP4/CP5                                           |

## Reference

- Pin: `scripts/core2ai-pin.json`
- Docs: [`docs/README.md`](../../docs/README.md)
