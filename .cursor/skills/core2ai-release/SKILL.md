---
name: core2ai-release
description: >-
    core2ai release: tag @core2ai/core and apply the GitHub pin in api2ai and db2ai.
    Use when the user says core2ai release, release core2ai, bump/tag core2ai, or sync
    api2ai/db2ai to a new core2ai version. Always run Gate 0 (clean git in all three
    repos) first — stop if dirty unless the user explicitly overrides in a follow-up message.
---

# core2ai release

**Canonical skill** — also linked from api2ai/db2ai as a short stub.

Invoke: **„core2ai release“**.

Orchestrates a **three-repo** release: tag **core2ai**, then refresh **api2ai** and **db2ai** so `@core2ai/core` uses `github:annettedorothea/core2ai#<tag>` (never `file:` in committed files).

Sibling repos (same parent as this repo):

- `../api2ai`
- `../db2ai`

## Gate 0 — clean git (mandatory, hard stop)

**This gate runs first.** Nothing else in this skill may run before it passes — not Step 0, not version questions, not file edits, not installs, not commits.

Run from **core2ai** root:

```bash
for d in . ../api2ai ../db2ai; do echo "=== $d ==="; git -C "$d" status -sb; git -C "$d" status --porcelain || echo "missing"; done
```

### Clean vs dirty

- **Clean** = `git status --porcelain` is **empty** in all three repos.
- **Dirty** = any modified, staged, deleted, or **untracked** path in any repo. Untracked files count as dirty (do not assume they are harmless).

### If any repo is dirty — STOP

1. Report **each** dirty repo with `git status -sb` output (paths + branch state).
2. **End the skill run.** Do not continue to Step 0 or any later step.
3. Tell the user to **commit**, **stash**, or **discard** the unrelated WIP, then re-run **„core2ai release“**.

**Forbidden when dirty** (even if it seems helpful):

- Do **not** bump versions, edit `core2ai-pin.json`, tag, push, or run pin refresh in consumers before the tag exists.
- Do **not** offer to “commit everything as part of the release” as the default next step.
- Do **not** use **AskQuestion** with options like “proceed and commit WIP” vs “stop” — stopping is not a choice; it is the only allowed outcome until the tree is clean.
- Do **not** mix unrelated WIP into release commits to “get clean”. Release commits must contain **only** release-related changes made **during** this skill run.

### Only override when the user explicitly opts in

Continue past Gate 0 **only** if the user, **in a new message after the stop**, clearly overrides, e.g.:

- „trotzdem weitermachen“
- „dirty OK, WIP mit in die Release-Commits“
- „include current WIP in release“

Then:

1. List exactly which paths will be included from each dirty repo.
2. Note in the final summary that the release included pre-existing WIP (higher review risk).
3. Still do **not** silently fold unrelated changes into release commits — either commit WIP separately first (preferred) or ask once which paths belong in which commit.

### Re-check before push/tag (core2ai Step 2)

Immediately before `git commit` / `git tag` / `git push` in core2ai, run `git status --porcelain` again. If **new** unexpected dirty paths appeared (not from Steps 1–2 of this run), stop and ask — do not push a mixed commit.

## Step 0 — Show current version and ask for the next

**Only after Gate 0 passes.** Do not guess the next version.

1. Read current pin:

    ```bash
    cd <core2ai-root>
    npm run core2ai:pin
    cat scripts/core2ai-pin.json
    ```

2. Read `version` from root `package.json` and `packages/codegen/package.json`, `packages/mcp-host/package.json` (should match pin, e.g. `0.0.4` ↔ tag `v0.0.4`).

3. Tell the user clearly, for example:

    > **Aktuell:** Pin `github:annettedorothea/core2ai#v0.0.4`, package version `0.0.4`.

4. **Ask the user** for the next version (tag + semver), e.g. `v0.0.5` / `0.0.5`. Use **AskQuestion** or a direct question. Wait for an answer before changing files.
    - Tag format: `v` + semver (`v0.0.5`, not `0.0.5` alone).
    - Never reuse or force-move an existing tag on the remote.

## Step 1 — core2ai: bump and verify

In **core2ai** root:

1. Set `version` to `X.Y.Z` (without `v`) in:
    - `package.json`
    - `packages/codegen/package.json`
    - `packages/mcp-host/package.json`
2. Update `scripts/core2ai-pin.json`:

    ```json
    {
        "owner": "annettedorothea",
        "repo": "core2ai",
        "tag": "vX.Y.Z",
        "spec": "github:annettedorothea/core2ai#vX.Y.Z"
    }
    ```

3. If `packages/codegen/src/index.ts` exports `CORE2AI_CODEGEN_VERSION`, set it to `X.Y.Z`.

4. Run:

    ```bash
    npm run build
    npm run test
    npm run check
    ```

5. Fix failures before tagging.

## Step 2 — core2ai: commit and tag

**Git safety**

- **Never** run `git config`.
- Commits use the repo’s existing identity (e.g. `annettedorothea <github@anfelisa.de>`). Verify with `git log -1 --format='%an <%ae>'` if needed.
- Release commits are **part of this skill** once Gate 0 passed — but each commit must contain **only** files changed for this release (version bump, pin json, release notes if any). Never `git add -A` blindly if unrelated paths are still dirty from an explicit dirty override.
- Do not force-push tags.
- Re-run Gate 0’s `git status --porcelain` check before commit; abort if unexpected paths appear.

When committing the core2ai release:

```bash
cd <core2ai-root>
git add -A
git status
git commit -m "$(cat <<'EOF'
Release vX.Y.Z: <short why, e.g. shared pin scripts>

EOF
)"
git push origin main
git tag -a vX.Y.Z -m "core2ai vX.Y.Z"
git push origin vX.Y.Z
```

Confirm tag on remote: `git ls-remote --tags origin 'vX.Y.Z'`.

## Step 3 — api2ai: apply pin

In **api2ai** root (`../api2ai`):

1. Ensure `core2ai-pin.targets.json` exists (lists `packages/cli/package.json`, demos, optional `generatorFallback`).

2. Refresh pin (tag must exist on remote first). Uses sibling `../core2ai/scripts` when present:

    ```bash
    npm run core2ai:use-pin
    npm run install:demos
    ```

    `core2ai:use-pin` = apply pin from `core2ai-pin.json` + remove cached `@core2ai/core` + forced reinstall per target + root `npm install` (GitHub HTTPS rewrite when needed).

3. Verify no `file:` pin remains:

    ```bash
    rg "file:.*core2ai" --glob 'package*.json'
    ```

    Expect only `github:annettedorothea/core2ai#vX.Y.Z`.

4. Run:

    ```bash
    npm run langium:generate
    npm run build
    npm run bundle:mcp-runtime
    npm run generate:all
    npm run check
    npm run test
    ```

    `bundle:mcp-runtime` rebuilds [`packages/cli/resources/mcp-serve-emitted.mjs`](../../packages/cli/resources/mcp-serve-emitted.mjs). `generate:all` copies it to `packages/extension/demos/generated/cli/mcp-serve.mjs`.

5. Commit pin + lockfile changes (message e.g. `Bump @core2ai/core to vX.Y.Z`). Stage only release-related paths — not unrelated WIP.

## Step 4 — db2ai: apply pin

In **db2ai** root (`../db2ai`):

1. Same as api2ai, but **no** `install:demos`:

    ```bash
    npm run core2ai:use-pin
    ```

2. Verify no `file:` core2ai pins in `package*.json`.

3. Run:

    ```bash
    npm run langium:generate
    npm run build
    npm run bundle:mcp-runtime
    npm run generate:all
    npm run check
    npm run test:unit
    ```

    `bundle:mcp-runtime` + `generate:all` refresh the MCP stdio host under `packages/extension/demos/generated/cli/mcp-serve.mjs`. Restart MCP servers in Cursor after release.

    (Full `npm run test` if Docker e2e is acceptable.)

4. Commit pin + lockfile changes. Stage only release-related paths.

## Checklist (copy for the user)

```text
- [ ] Gate 0: all three repos clean (or user sent explicit dirty override after stop)
- [ ] Current version shown; next version confirmed by user
- [ ] core2ai: versions + core2ai-pin.json + build/test/check
- [ ] core2ai: commit + tag vX.Y.Z pushed (if requested)
- [ ] api2ai: core2ai:use-pin (+ install:demos)
- [ ] api2ai: bundle:mcp-runtime + generate:all + build/check/test green
- [ ] db2ai: core2ai:use-pin
- [ ] db2ai: bundle:mcp-runtime + generate:all + build/check/test green
- [ ] No file:../../../core2ai in committed package.json files
```

## Troubleshooting

| Problem                                     | Action                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Skill started but repos were dirty          | Expected — Gate 0 stop. User commits/stashes WIP, re-runs skill. Do not “fix” by bundling WIP into release. |
| `npm install` / tag checkout fails          | Tag not pushed yet, or wrong tag name. Push tag from core2ai first.                                         |
| Lockfile still resolves old core2ai commit  | Re-run `npm run core2ai:use-pin`. Use sibling `../core2ai` or set `CORE2AI_PIN_SOURCE`.                     |
| Pin scripts missing from node_modules       | `run-core2ai-script.mjs` falls back to `../core2ai/scripts`.                                                |
| SSH / known_hosts errors                    | `npm run install:github-https` (HTTPS rewrite for this install only).                                       |
| db2ai `install` fails on workspace packages | Run from **db2ai repo root** (workspaces), not only `packages/cli`.                                         |

## Reference

- Pin source of truth: `scripts/core2ai-pin.json` (this repo)
- Consumer targets: `core2ai-pin.targets.json` in api2ai / db2ai
- Docs hub: [`docs/README.md`](../../docs/README.md)
- Cursor rule: `.cursor/rules/github-core-dependency.mdc` in each consumer
