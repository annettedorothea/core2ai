---
name: core2ai-release
description: >-
    core2ai release: tag @core2ai/core and apply the GitHub pin in api2ai and db2ai.
    Use when the user says core2ai release, release core2ai, bump/tag core2ai, or sync
    api2ai/db2ai to a new core2ai version.
---

# core2ai release

Invoke: **„core2ai release“** (or **release-core2ai-consumers** — same skill).

Orchestrates a **three-repo** release: tag **core2ai**, then refresh **api2ai** and **db2ai** so `@core2ai/core` uses `github:annettedorothea/core2ai#<tag>` (never `file:` in committed files).

Sibling repos (same parent as this repo):

- `../api2ai`
- `../db2ai`

## Prerequisites — clean git in all three repos

**Before** showing the version or changing any file, verify a **clean working tree** in **core2ai**, **api2ai**, and **db2ai**.

In each repo root:

```bash
git status --porcelain
```

- **Clean** = empty output (nothing to commit; untracked files that are intentional noise may still block a safe release — treat untracked files as dirty unless the user says to ignore them).
- **Dirty** = any modified, staged, or untracked paths that belong to the release (source, `package.json`, lockfiles, generated demos, etc.).

If **any** repo is dirty:

1. Report which repo(s) and list changed/untracked paths (`git status -sb`).
2. **Stop** the skill workflow. Do not bump versions, tag, or run `apply-pin` until the tree is clean.
3. Tell the user to **commit**, **stash**, or **discard** those changes first, then re-run the skill.

Only continue after all three repos are clean, **or** the user explicitly says to proceed anyway (e.g. “trotzdem weitermachen” / “include current WIP”) — then note that risk in the summary.

Optional quick check (all three):

```bash
for d in . ../api2ai ../db2ai; do echo "=== $d ==="; git -C "$d" status --porcelain || echo "missing"; done
```

(Run from **core2ai** root.)

## Step 0 — Show current version and ask for the next

**Always start here** (after prerequisites pass). Do not guess the next version.

1. Read current pin:

    ```bash
    cd <core2ai-root>
    npm run core2ai:pin
    cat scripts/core2ai-pin.json
    ```

2. Read `version` from root `package.json` and `packages/codegen/package.json`, `packages/mcp-host/package.json` (should match pin, e.g. `0.0.2` ↔ tag `v0.0.2`).

3. Tell the user clearly, for example:

    > **Aktuell:** Pin `github:annettedorothea/core2ai#v0.0.2`, package version `0.0.2`.

4. **Ask the user** for the next version (tag + semver), e.g. `v0.0.3` / `0.0.3`. Use **AskQuestion** or a direct question. Wait for an answer before changing files.
    - Tag format: `v` + semver (`v0.0.3`, not `0.0.3` alone).
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
- Only commit when the user asked for commits in this run.
- Do not force-push tags.

When the user wants commits:

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

2. Install the new tag, then apply pin:

    ```bash
    npm run install:github-https
    npm run core2ai:apply-pin
    npm run install:github-https
    npm run install:demos
    ```

    Scripts live in `node_modules/@core2ai/core/scripts/` (requires the new tag to include `scripts/` in the published package).

3. Verify no `file:` pin remains:

    ```bash
    rg "file:.*core2ai" --glob 'package*.json'
    ```

    Expect only `github:annettedorothea/core2ai#vX.Y.Z`.

4. Run:

    ```bash
    npm run langium:generate
    npm run build
    npm run check
    npm run test
    ```

5. Commit **only if the user asked** (lockfile + pin changes; message e.g. `Bump @core2ai/core to vX.Y.Z`).

## Step 4 — db2ai: apply pin

In **db2ai** root (`../db2ai`):

1. Same as api2ai, but **no** `install:demos`.

    ```bash
    npm run install:github-https
    npm run core2ai:apply-pin
    npm run install:github-https
    ```

2. Verify no `file:` core2ai pins in `package*.json`.

3. Run:

    ```bash
    npm run langium:generate
    npm run build
    npm run check
    npm run test:unit
    ```

    (Full `npm run test` if Docker e2e is acceptable.)

4. Commit **only if the user asked**.

## Checklist (copy for the user)

```text
- [ ] core2ai, api2ai, db2ai: git working tree clean (or user approved dirty state)
- [ ] Current version shown; next version confirmed by user
- [ ] core2ai: versions + core2ai-pin.json + build/test/check
- [ ] core2ai: commit + tag vX.Y.Z pushed (if requested)
- [ ] api2ai: install:github-https → apply-pin → install (+ demos)
- [ ] api2ai: build/check/test green
- [ ] db2ai: install:github-https → apply-pin → install
- [ ] db2ai: build/check/test green
- [ ] No file:../../../core2ai in committed package.json files
```

## Troubleshooting

| Problem                                     | Action                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm install` / tag checkout fails          | Tag not pushed yet, or wrong tag name. Push tag from core2ai first.                     |
| `core2ai:apply-pin` missing scripts         | Consumer’s `@core2ai/core` is too old; `npm run install:github-https` after tag exists. |
| SSH / known_hosts errors                    | `npm run install:github-https` (HTTPS rewrite for this install only).                   |
| db2ai `install` fails on workspace packages | Run from **db2ai repo root** (workspaces), not only `packages/cli`.                     |

## Reference

- Pin source of truth: `scripts/core2ai-pin.json` (this repo)
- Consumer targets: `core2ai-pin.targets.json` in api2ai / db2ai
- Cursor rule: `.cursor/rules/github-core-dependency.mdc` in each consumer
