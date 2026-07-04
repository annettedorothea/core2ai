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

**Invoke:** `guided release`, `release`, `release CP0`, `release CP C3`, `release weiter`, `release ab CP4`.

**Repos:** `core2ai`, `../api2ai`, `../db2ai` (sibling layout). VSIX-Releases laufen **pro Consumer** (api2ai oder db2ai); beide nacheinander, wenn der User beide will.

## Hard rules

1. **No automatic git** — never `git commit`, `git push`, `git tag`, or `gh release` unless the user explicitly asks.
2. **User commits in the IDE** — at commit CPs, output only **repo** + **commit message** (+ optional one-line note). No `git add` lists.
3. **One checkpoint per turn** — status table with `[x]` / `[ ]`; wait for `release weiter` or manual test OK.
4. **Agent may run** `npm run …` — not git.
5. **Version before VSIX** — bump and **push** consumer version **before** `vsix:build` (VSIX filename = committed version).
6. **`.vsix` is local** — not committed; GitHub upload only via `vsix:release` after manual preview.
7. **Verify once after bump** — `npm run vsix:prepare` after `vsix:version` replaces a separate `generate:all` / `check` / `npm test` pass (those steps are already inside `vsix:prepare`).
8. **core2ai publish order** — during hacking: sibling link (`sync:core2ai-pin`). **After** npm publish (CP **C4**): registry pin (`sync:core2ai-pin:npm`) in both consumers **before** consumer CI / VSIX release. Never commit sibling-linked lockfiles when CI expects registry.

## Checkpoint map

| CP     | Name                                      | Who   |
| ------ | ----------------------------------------- | ----- |
| **0**  | Clean git (three repos)                   | Agent |
| **C1** | core2ai bump + verify                     | Agent |
| **C2** | Commit core2ai                            | User  |
| **C3** | Tag `vX.Y.Z` + push tag → npmjs           | User  |
| **C4** | Confirm npm publish (Actions / npm view)  | User  |
| **C5** | Consumer registry pin sync                | Agent |
| **C6** | Commit consumer lockfiles                 | User  |
| **1**  | Consumer VSIX version bump                | Agent |
| **2**  | Verify pipeline (`vsix:prepare`)          | Agent |
| **3**  | Commit + push consumer release            | User  |
| **4**  | VSIX build                                | Agent |
| **5**  | Manual preview                            | User  |
| **6**  | GitHub release (`vsix:release`)           | User  |

**CP C1–C6** whenever **core2ai** `package.json` version changes (codegen release or coordinated minor). Skip only if that version is already on npmjs **and** both consumers have registry lockfiles for it.

During active core2ai work, **C1–C2** may use sibling link locally; **C5–C6** (registry) are still required before consumer CI passes.

---

## CP0 — Clean git

Agent: `git status` in **core2ai**, **api2ai**, **db2ai**.

- **Stop** if dirty before release work — **repo + commit message** per repo (IDE).
- **Exception:** after **CP1–CP2** until **CP3** push, the releasing consumer may stay dirty (version bump ± regenerated demos from `vsix:prepare`) — expected.
- **Exception:** after **C5** until **C6** push, both consumers may stay dirty (registry pin + lockfile) — expected.

→ **CP C1** (if core2ai bump needed) or **CP1**

---

## CP C — core2ai npm publish + consumer pin

**@toolfactory.dev/core** publishes to **npmjs** via **Git tag** — not manual `npm publish` in normal flow.

Workflow: [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml) — on push of tag `v*`: `npm ci` → tag/version check → `check` → `test` → `npm publish --provenance`.

```
C1 bump → C2 commit → C3 tag push → npmjs → C4 verify → C5 sync:npm → C6 commit consumers → CP1…
```

Tag **`vX.Y.Z`** must match **`package.json` `version`** (`v1.0.0-rc.1` ↔ `1.0.0-rc.1`). Mismatch fails the publish workflow.

---

### C1 — Bump + verify (agent)

From **core2ai** root:

```bash
npm run version -- X.Y.Z
npm run build && npm run check && npm test
```

CHANGELOG should already have a `[X.Y.Z]` section (date on release day).

**End C1:** stop → **C2**

---

### C2 — Commit core2ai (user)

| Repo      | Message (example)                    |
| --------- | ------------------------------------ |
| `core2ai` | `Release v1.0.0-rc.1: hooks codegen` |

Push **`main`** (or your default branch) **before** tagging.

**End C2:** stop → **C3**

---

### C3 — Tag + push tag (user)

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

- Pushes **only the tag** — commit from **C2** must already be on the remote.
- GitHub Action **publish** publishes `@toolfactory.dev/core@X.Y.Z` to **registry.npmjs.org**.
- **Do not** re-use a tag/npm version — npm rejects duplicate publishes. Bump to a new version (e.g. `rc.2`) instead.

Emergency local publish (no CI): `npm publish` from **core2ai** root after build — prefer **C3** tag flow.

**End C3:** stop → **C4**

---

### C4 — Confirm npm publish (user)

1. GitHub → **core2ai** → Actions → workflow **publish** → green.
2. Or terminal: `npm view @toolfactory.dev/core version` → `X.Y.Z`.

If publish failed: read Action log, fix, **new** version + commit + **new** tag. Never force-push published tags.

**End C4:** stop → **C5**

---

### C5 — Registry pin sync (agent)

In **api2ai** and **db2ai** roots:

```bash
npm run sync:core2ai-pin:npm
# optional explicit version:
# node scripts/sync-core2ai-pin.mjs --npm X.Y.Z
```

Confirm in each repo:

- `packages/cli/package.json` → `"@toolfactory.dev/core": "X.Y.Z"`
- `package-lock.json` → `registry.npmjs.org/.../core-X.Y.Z.tgz`, **no** `"link": true`

**Local dev after C6:** `npm run sync:core2ai-pin` restores sibling `../core2ai` link (optional).

**End C5:** stop → **C6**

---

### C6 — Commit consumer pins (user)

One commit per repo (both consumers if both ship):

| Repo     | Message (example)                                              |
| -------- | -------------------------------------------------------------- |
| `api2ai` | `Sync @toolfactory.dev/core pin to X.Y.Z for CI (npm registry)` |
| `db2ai`  | same                                                           |

Push both before expecting green CI on either consumer.

**End C6:** stop → **CP1** (or done if core-only release)

---

## CP1 — Consumer VSIX version bump

Ask target **VSIX version** (`X.Y.Z`) — do not guess. VSIX version may differ from **core2ai** library version (e.g. core `1.0.0-rc.1`, VSIX `1.0.0-rc`).

From the **releasing consumer** root:

```bash
npm run vsix:version -- X.Y.Z
```

Updates root + `packages/cli`, `packages/language`, `packages/extension` `package.json` (workspace semver only — **not** `@toolfactory.dev/core` pin; use **CP C** for that).

Do **not** use `npm version` or single-file edits — misaligns VSIX filename vs package versions.

Confirm all four consumer workspace `package.json` files show the same `X.Y.Z`.

If core2ai was bumped but **C5–C6** not done: run **C5** first — CI needs registry lockfiles, not sibling link.

**End CP1:** stop → **CP2**

---

## CP2 — Verify pipeline

Agent runs in the **releasing consumer** (api2ai or db2ai):

1. If **core2ai** `src/codegen/**` changed: `npm run build && npm run check` in **core2ai** (or confirm `npm run watch` was running) — optional prelude if not done in **C1**.
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

**End CP2:** stop if red; else → **CP3**

---

## CP3 — Commit + push (user)

**One commit** per releasing consumer — feature/fix changes, VSIX version bumps, and any regenerated `generated/**/*.ts` from `vsix:prepare`, then **push**.

| Repo     | Message (example)                |
| -------- | -------------------------------- |
| `api2ai` | `Release v1.0.0-rc: <one line why>` |
| `db2ai`  | `Release v1.0.0-rc: <one line why>` |

(core2ai + pin sync already committed in **C2** / **C6**.)

**End CP3:** repos clean and pushed → **CP4**

---

## CP4 — VSIX build

From consumer root:

```bash
npm run vsix:build
```

Output (local, not committed): `packages/extension/vscode-api2ai-X.Y.Z.vsix` or `vscode-db2ai-X.Y.Z.vsix`.

**End CP4:** stop → **CP5**

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

| User says         | Agent does                         |
| ----------------- | ---------------------------------- |
| `guided release`  | CP0 → CP C1 or CP1                 |
| `release CP C3`   | Remind user: tag + push tag only   |
| `release CP C5`   | `sync:core2ai-pin:npm` both        |
| `release CP2`     | CP2 `vsix:prepare` only            |
| `release CP1`     | CP1 version bump only              |
| `release CP4`     | CP4 VSIX only                      |
| `release weiter`  | Next open CP                       |

---

## Troubleshooting

| Problem                                   | Action                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| CI `Cannot find module …/core/codegen`    | **C4** publish done? **C5–C6** registry lockfiles committed?           |
| CI `npm ci` 404 `@toolfactory.dev/core`   | Version not on npmjs yet — finish **C3–C4** first                      |
| publish workflow: tag/version mismatch    | Tag must be `v` + exact `package.json` version                       |
| npm publish: version already exists       | Bump new version (**C1**), commit (**C2**), new tag (**C3**)           |
| VSIX wrong version in filename            | **CP1** bump, **CP3** commit, **CP4** rebuild                          |
| `vsix:release` missing file               | Run **CP4** (`vsix:build`) first                                       |
| Prepare fails after bump                  | Fix code/generator; version may stay — re-run CP2                      |
| MCP broken after core2ai change           | Rebuild core2ai (`watch`/`build`), **CP2** again, restart MCP          |
| Check fails on generated output           | Fix generator or DSL — never hand-edit `generated/**` (see rules)      |

## Reference

- core2ai publish workflow: [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml)
- Link vs registry: [core2ai-link-vs-registry/SKILL.md](../core2ai-link-vs-registry/SKILL.md)
- Build/link: [`.cursor/rules/core2ai-build.mdc`](../../.cursor/rules/core2ai-build.mdc)
- core2ai library version: `npm run version -- X.Y.Z` → `scripts/bump-version.mjs`
- Consumer pin sync: `sync:core2ai-pin` (sibling) / `sync:core2ai-pin:npm` (registry) → `scripts/sync-core2ai-pin.mjs`
- Consumers: `vsix:version`, `vsix:prepare`, `vsix:build`, `vsix:release` in sibling api2ai/db2ai
