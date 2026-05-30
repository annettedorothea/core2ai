---
name: guided-release
description: >-
    Guided checkpoint release across core2ai, api2ai, and db2ai. One flow: optional @core2ai/core
    library tag, then consumer pin preview (no auto-commit), VSIX build and test. Stops after
    each checkpoint. Use for guided release, release, release CPn, or release weiter. Never
    git commit/push/tag unless the user explicitly asks. For commits: repo name + message only
    (user checks in via IDE).
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
3. **Tag / push / gh** — same: repo + what to do in plain words (e.g. „Tag `v0.0.5` auf `core2ai` pushen“), no long copy-paste unless the user asks.
4. **One checkpoint per turn** — after each CP, print status table; wait for `release weiter`, `release CPn`, or manual test OK.
5. **Agent may run** `npm run …` verify/preview commands (build, use-pin, bundle, generate, test) — not git.
6. **Two release kinds:** Library tag (`@core2ai/core` on **core2ai**); VSIX (**api2ai** / **db2ai** `packages/extension`).

## Checkpoint map

| CP     | Name                               | When                               |
| ------ | ---------------------------------- | ---------------------------------- |
| **0**  | Clean git (start)                  | Always first                       |
| **1**  | Need core2ai library release?      | Library track **or** skip to **4** |
| **2**  | core2ai: bump + verify             | Only if CP1 = yes                  |
| **3**  | core2ai: commit + tag (user)       | Only if CP1 = yes                  |
| **4**  | api2ai: pin preview (no commit)    | After tag **or** CP1 skipped       |
| **5**  | api2ai: pin commit (user)          | After manual preview OK            |
| **6**  | api2ai: VSIX build + preview       | After CP5                          |
| **7**  | api2ai: VSIX GitHub release (user) | Optional                           |
| **8**  | db2ai: pin preview (no commit)     | Same as 4                          |
| **9**  | db2ai: pin commit (user)           | After manual preview OK            |
| **10** | db2ai: VSIX build + preview        | After CP9                          |
| **11** | db2ai: VSIX GitHub release (user)  | Optional                           |

Print table with `[x]` / `[ ]` at start and after each CP.

---

## CP0 — Clean git (three repos)

Agent runs `git status` in all three repos (or user already knows).

- **Stop** if dirty **before** release work — give **repo + commit message** per repo (IDE checkout).
- **Exception:** after CP4/8 preview, api2ai/db2ai may stay dirty until CP5/9 — OK on resume.

**End CP0:** → CP1 (or stop until clean).

---

## CP1 — Library release needed?

From **core2ai**: `npm run core2ai:pin`, read `scripts/core2ai-pin.json`, `git log <tag>..HEAD --oneline -- packages/ scripts/ README.md docs/`.

- **Yes** if `packages/` / `scripts/` changed since tag or user says mcp-host/codegen changed.
- **No** → skip to **CP4** (default api2ai first).

Ask: **Library-Release nötig?** (ja → CP2 / nein → CP4)

**End CP1:** wait for answer.

---

## CP2 — core2ai: bump + verify (no git)

Only if library = yes. Ask target `vX.Y.Z`. Bump version files + `core2ai-pin.json` (+ `CORE2AI_CODEGEN_VERSION` if present). Run `npm run build`, `test`, `check`. Fix before CP3.

**End CP2:** stop → `release CP3`.

---

## CP3 — core2ai: commit + tag (user)

After CP2 green.

**Commit (IDE):**

| Repo      | Message                          |
| --------- | -------------------------------- |
| `core2ai` | `Release vX.Y.Z: <one line why>` |

Then user: push `main`, annotated tag `vX.Y.Z`, push tag. Confirm tag on remote before CP4.

**End CP3:** stop.

---

## CP4 — api2ai: pin preview (no commit)

Prerequisite: tag on GitHub or CP1 skipped.

Agent may run: `core2ai:use-pin`, `install:demos`, `langium:generate`, `build`, `bundle:mcp-runtime`, `generate:all`, `check`, `test:unit`. No `file:` pin in manifests.

**User manual:** MCP restart; Extension Dev Host on demos; generate/smoke/MCP as needed.

**End CP4:** stop until preview OK.

---

## CP5 — api2ai: pin commit (user)

| Repo     | Message                                     |
| -------- | ------------------------------------------- |
| `api2ai` | `chore(deps): bump @core2ai/core to vX.Y.Z` |

**End CP5:** → CP6.

---

## CP6 — api2ai: VSIX preview

Agent may run: `npm run extension:vsix -w packages/extension`. User: install VSIX, reload, smoke extension/MCP.

**End CP6:** stop until OK.

---

## CP7 — api2ai: VSIX GitHub (user, optional)

User runs `npm run release:vsix` in **api2ai** when ready (Docker/e2e as needed). No `gh` from agent unless asked.

---

## CP8 — db2ai: pin preview

Same as CP4: `use-pin`, `langium:generate`, `build`, `bundle:mcp-runtime`, `generate:all`, `check`, `test:unit`. Manual: demos, `test:smoke:pagila`, MCP restart, Docker if needed.

---

## CP9 — db2ai: pin commit (user)

| Repo    | Message                                     |
| ------- | ------------------------------------------- |
| `db2ai` | `chore(deps): bump @core2ai/core to vX.Y.Z` |

---

## CP10 — db2ai: VSIX preview

Agent may run `extension:vsix`. User installs and tests.

---

## CP11 — db2ai: VSIX GitHub (user, optional)

User runs `npm run release:vsix` in **db2ai** (Docker for e2e).

---

## Resume

| User says        | Agent does      |
| ---------------- | --------------- |
| `guided release` | CP0 → CP1       |
| `release CPn`    | That CP only    |
| `release weiter` | Next open CP    |
| `library only`   | CP0–3 then stop |

---

## Troubleshooting

| Problem              | Action                                                |
| -------------------- | ----------------------------------------------------- |
| `use-pin` fails      | Tag not on remote — finish CP3 tag first              |
| `bundle:mcp-runtime` | Need GitHub pin, not `use-local`                      |
| Push hook pin fail   | `core2ai:check-push-pin` — pin in committed manifests |
| SSH install          | `install:github-https` in that repo                   |

## Reference

- Pin: `scripts/core2ai-pin.json`
- Docs: [`docs/README.md`](../../docs/README.md)
