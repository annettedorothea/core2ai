---
name: guided-release
description: >-
    Guided VSIX release for api2ai and db2ai (optional core2ai tag). Canonical skill
    lives in core2ai only (sibling repos api2ai/db2ai). One checkpoint per turn: clean git,
    version bump, vsix:prepare, vsix:build, manual test, then commit (incl. registry pin +
    generated mcpServerVersion), GitHub release. Use for guided release, release, release CPn,
    or release weiter. Never git commit/push/tag/gh unless the user explicitly asks. For
    commits: repo + message only (user checks in via IDE).
---

# Guided release

**Ein Flow**, unterbrechbar. Der Agent führt **höchstens einen Checkpoint** pro Antwort aus und **stoppt** danach.

**Invoke:** `guided release`, `release`, `release CP0`, `release CP C3`, `release CP1`, `release weiter`.

**Repos:** `core2ai`, `../api2ai`, `../db2ai` (sibling layout). **Single skill file:** `core2ai/.cursor/skills/guided-release/SKILL.md` — do not duplicate in consumer repos. VSIX-Releases laufen **pro Consumer** (api2ai oder db2ai); beide nacheinander, wenn der User beide will.

## Warum Commit erst nach manuellem Test (Consumer)

Consumer-CI erwartet **`@toolfactory.dev/core` vom npm-Registry-Pin** in `package-lock.json`. Ein Push **ohne** Pin (nur Feature-Änderungen) schlägt fehl.

Deshalb **ein** Release-Commit **nach** `vsix:prepare` + `vsix:build` + manuellem VSIX-Test — nicht vorher. Lokal bleibt der Consumer dirty von **CP1** bis **CP5**; das ist gewollt.

**Nicht** vor dem Release einen separaten Feature-Commit pushen, wenn er den Registry-Pin noch nicht enthält.

## Hard rules

1. **No automatic git** — never `git commit`, `git push`, `git tag`, or `gh release` unless the user explicitly asks.
2. **User commits in the IDE** — at commit CPs, output only **repo** + **commit message** (+ optional one-line note). No `git add` lists.
3. **One checkpoint per turn** — status table with `[x]` / `[ ]`; wait for `release weiter` or manual test OK.
4. **Agent may run** `npm run …` — not git.
5. **Version before VSIX build** — `vsix:version` in **CP1**; consumer **commit** in **CP5** (after manual test), **not** before **CP3** `vsix:build`.
6. **`.vsix` is local** — not committed; GitHub upload only via `vsix:release` after manual preview.
7. **Consumer release commit (CP5)** bundles **feature changes + registry pin + CHANGELOG + VSIX version + `generated/**`** (`mcpServerVersion` in `*-tools.ts`) — **one** commit, not split.
8. **`vsix:prepare` before commit** — **CP2** runs `generate:all`; rewrites `mcpServerVersion`. **Do not commit before CP2** or generated tools stay on the old version.
9. **core2ai publish order** — during hacking: sibling link (`sync:core2ai-pin`). **After** npm publish (**C4**): registry pin in **CP1** (`sync:core2ai-pin:npm`) **before** consumer VSIX work. Never commit sibling-linked lockfiles when CI expects registry.
10. **No consumer push until CP5** — build and test the same tree you will commit.

## Checkpoint map

| CP     | Name                                           | Who   |
| ------ | ---------------------------------------------- | ----- |
| **0**  | Clean git (three repos)                        | Agent |
| **C1** | core2ai CHANGELOG + bump + verify              | Agent |
| **C2** | Commit + push core2ai                          | User  |
| **C3** | Tag `vX.Y.Z` + push tag → npmjs                | User  |
| **C4** | Confirm npm publish (Actions / npm view)       | User  |
| **1**  | Consumer: pin + CHANGELOG + `vsix:version`     | Agent |
| **2**  | `vsix:prepare` (verify + regenerate demos)     | Agent |
| **3**  | `vsix:build`                                   | Agent |
| **4**  | Manual preview (install `.vsix`, smoke /test-all) | User  |
| **5**  | Commit + push consumer release                 | User  |
| **6**  | GitHub release (`vsix:release`)                  | User  |

**CP C1–C4** whenever **core2ai** `package.json` version changes. Skip only if that version is already on npmjs.

**CP1–CP6** repeat per releasing consumer (api2ai, then db2ai if both ship).

```
C1 → C2 → C3 → npmjs → C4 → CP1 → CP2 prepare → CP3 build → CP4 test → CP5 commit → CP6 release
```

---

## CP0 — Clean git

Agent: `git status` in **core2ai**, **api2ai**, **db2ai**.

- **core2ai** should be clean before **C1** (feature work already committed).
- **Consumer (api2ai/db2ai):** dirty workspace is **OK** for release — do **not** ask for a feature-only commit + push before **CP1**. All release changes stay local until **CP5**.
- After **CP5** push, tree should be clean before **CP6**.

→ **CP C1** (if core2ai bump needed) or **CP1** (consumer)

---

## CP C — core2ai npm publish

**@toolfactory.dev/core** publishes to **npmjs** via **Git tag**.

Workflow: [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml) — tag `v*`: `npm ci` → version check → `check` → `test` → `npm publish --provenance`.

Tag **`vX.Y.Z`** must match **`package.json` `version`**.

### C1 — CHANGELOG + bump + verify (agent)

From **core2ai** root:

```bash
# Agent: add ## [X.Y.Z] - YYYY-MM-DD to CHANGELOG.md (move [Unreleased] content)
npm run version -- X.Y.Z
# bumps package.json and runs npm install (syncs package-lock.json version)
npm run build && npm run check && npm test
```

**End C1:** stop → **C2**

### C2 — Commit + push core2ai (user)

| Repo      | Message (example)                                              |
| --------- | -------------------------------------------------------------- |
| `core2ai` | `Release v1.0.0-rc.4: hook stubs one file per export, demo start docs` |

**End C2:** stop → **C3**

### C3 — Tag + push tag (user)

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

**End C3:** stop → **C4**

### C4 — Confirm npm publish (user)

`npm view @toolfactory.dev/core version` → `X.Y.Z`, or Actions **publish** green.

**End C4:** stop → **CP1**

---

## CP1 — Consumer: pin + CHANGELOG + VSIX version (agent)

**One agent step** per releasing consumer. Ask target **VSIX version** (`X.Y.Z`) — do not guess. VSIX version may differ from **core** (e.g. core `1.0.0-rc.4`, VSIX `1.0.0-rc.2`).

From the **releasing consumer** root:

1. **Registry pin** (skip if already on published core version):

    ```bash
    npm run sync:core2ai-pin:npm
    # optional: node scripts/sync-core2ai-pin.mjs --npm X.Y.Z
    ```

    Confirm: `packages/cli/package.json` + `package-lock.json` → `registry.npmjs.org/.../core-X.Y.Z.tgz`, **no** `"link": true` on core.

2. **CHANGELOG** — add `## [VSIX.X.Y.Z] - YYYY-MM-DD` with user-facing changes (features on `main`, pin note if useful). Clear `[Unreleased]`.

3. **VSIX version bump:**

    ```bash
    npm run vsix:version -- X.Y.Z
    ```

    Updates root + `packages/cli`, `packages/language`, `packages/extension` — **not** `@toolfactory.dev/core` (step 1). Runs `npm install` so `package-lock.json` workspace `version` fields match.

Confirm all four consumer workspace `package.json` files show the same VSIX `X.Y.Z`.

If **C4** not done: stop — npm must have the core version first.

**Do not commit yet** — **CP2** must run first (`mcpServerVersion`); **CP5** is the only consumer commit.

**End CP1:** stop → **CP2**

---

## CP2 — Verify (`vsix:prepare`)

Agent runs in the **releasing consumer**:

```bash
npm run vsix:prepare
```

Runs `langium:generate`, `build`, `install:demos`, `generate:all`, `build:generated`, `check`, workspace tests. Does **not** package a VSIX.

**Expected:** `packages/extension/demos/generated/**/tools/*-tools.ts` export `mcpServerVersion` equal to the VSIX version from **CP1**. Include those files in **CP5**.

If prepare fails: fix code or generator; re-run **CP2** — version/CHANGELOG from **CP1** usually stay.

**End CP2:** stop if red; else → **CP3**

---

## CP3 — VSIX build (agent)

```bash
npm run vsix:build
```

Output (local): `packages/extension/vscode-api2ai-X.Y.Z.vsix` or `vscode-db2ai-X.Y.Z.vsix`.

Filename must match **CP1** version (nothing committed yet — that is OK).

**End CP3:** stop → **CP4**

---

## CP4 — Manual preview (user)

1. Install **`.vsix`** from **CP3** (Run and Debug or **Install from VSIX**); reload window.
2. Demo workspace: `npm run start:all`, MCP smoke-test.
3. **db2ai:** Docker for DB demos.
4. Optional: `/test-all` before **CP5**.

**End CP4:** stop until OK → **CP5**

If test fails: fix locally, re-run **CP2** (if codegen) or **CP3** (if extension-only) — still **no** commit until green.

---

## CP5 — Commit + push consumer release (user)

**One commit** per releasing consumer — **after** green **CP4** (same tree you tested):

- All feature / demo / generator changes from the release
- `packages/cli/package.json` (core pin)
- `package-lock.json`
- `CHANGELOG.md`
- root + `packages/cli` + `packages/language` + `packages/extension` `package.json` (VSIX version)
- `packages/extension/demos/generated/**/*.ts` (and `scripts/generated/**` if prepare rewrote them)
- `packages/extension/demo-bundle-required.json` if changed

Do **not** include `.vsix` or `dist/mcp/`.

| Repo     | Message (example)                                                       |
| -------- | ----------------------------------------------------------------------- |
| `api2ai` | `Release v1.0.0-rc.2: hook stubs, demo scripts, core 1.0.0-rc.4`      |
| `db2ai`  | same pattern                                                            |

Push before **CP6**.

**End CP5:** stop → **CP6**

---

## CP6 — GitHub release (user)

After **CP5** push — same **`.vsix`** file you tested in **CP4**:

```bash
npm run vsix:release
```

Repeat **CP1–CP6** for the other consumer if both ship.

---

## Resume

| User says        | Agent does                                        |
| ---------------- | ------------------------------------------------- |
| `guided release` | CP0 → CP C1 or CP1                                |
| `release CP C3`  | Remind: tag + push tag only                       |
| `release CP1`    | pin + CHANGELOG + `vsix:version` for one consumer |
| `release CP2`    | `vsix:prepare` only                               |
| `release CP3`    | `vsix:build` only                                 |
| `release weiter` | Next open CP                                      |

---

## Troubleshooting

| Problem                                | Action                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------- |
| CI fails after push without core pin   | Use **CP5** single commit; do not push feature-only before pin         |
| CI cannot find `…/core/codegen`        | **C4** done? **CP5** includes registry pin?                            |
| CI 404 `@toolfactory.dev/core`         | Finish **C3–C4** first                                                 |
| VSIX wrong filename version            | **CP1** bump, **CP3** rebuild, retest, then **CP5**                    |
| `mcpServerVersion` still old on main     | **CP2** before **CP5**; include `generated/**` in release commit       |
| Prepare fails after **CP1**            | Fix code; re-run **CP2** — version/CHANGELOG usually stay              |
| MCP broken after core publish          | **CP2** again, restart MCP                                             |
| Committed before test, CI green but VSIX bad | Rebuild/test locally; fix + new commit (avoid — follow CP4 before CP5) |

## Reference

- core2ai publish: [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml)
- Link vs registry: [core2ai-link-vs-registry/SKILL.md](../core2ai-link-vs-registry/SKILL.md)
- CHANGELOG policy: [docs/development/changelog-policy.md](../../docs/development/changelog-policy.md)
- Consumers: `vsix:version`, `vsix:prepare`, `vsix:build`, `vsix:release`
- Generator: `mcpServerVersion` in `packages/cli/src/generator/render-tools-module.ts`
