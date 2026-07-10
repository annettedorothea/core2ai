---
name: core2ai-link-vs-registry
description: >-
    Switch @toolfactory.dev/core between sibling npm link (local core2ai hacking) and npmjs
    registry (CI / after publish). Use when changing core2ai codegen, refreshing consumer pins,
    sync:core2ai-pin, npm link, hooks refactor, or asking link vs registry.
---

# core2ai link vs npm registry

`@toolfactory.dev/core` ships compiled **`out/`** only. Consumers import `@toolfactory.dev/core/codegen`.

Two supported workflows — pick one per task; do **not** mix casually.

## Modes

| Mode | When | Consumer pin command | Lockfile resolves from |
|------|------|----------------------|-------------------------|
| **Link (sibling)** | Active **core2ai** / codegen work; hooks refactor; before republish | `npm run sync:core2ai-pin` | `../core2ai`, `"link": true` |
| **Registry (npmjs)** | After `@toolfactory.dev/core` publish; CI; VSIX release with published core | `npm run sync:core2ai-pin:npm` | `registry.npmjs.org` tarball |

**Do not** put `file:../../../core2ai` in `packages/cli/package.json`. Keep semver pin + lockfile resolution (link or registry).

## Verify current mode

From **api2ai** or **db2ai** root:

```bash
ls -l node_modules/@toolfactory.dev/core
grep -A3 '"node_modules/@toolfactory.dev/core"' package-lock.json | head -6
```

| Link mode | Registry mode |
|-----------|---------------|
| Symlink → `../core2ai` | Regular directory or no symlink |
| Lockfile: `"link": true`, version path `../core2ai` | Lockfile: `resolved` → `registry.npmjs.org/.../core-….tgz` |

Quick runtime check (from `packages/cli`):

```bash
node -e "import { renderPrepareToolCallHooksMap } from '@toolfactory.dev/core/codegen'; console.log(renderPrepareToolCallHooksMap([{toolName:'t',access:'public'}]));"
```

If output lacks recent codegen (e.g. `credential?: string`), you are on **stale registry** or **stale VSIX embed** — switch to link and rebuild core2ai.

## Switch to link mode (default for core2ai hacking)

From **api2ai** or **db2ai** root (sibling `../core2ai` required):

```bash
npm run sync:core2ai-pin
```

This installs `file:../core2ai` into the lockfile (`"link": true`) and **restores** the semver pin in `packages/cli/package.json`.

**Optional** global link (may fail with `EACCES` on some machines — `sync:core2ai-pin` alone is enough):

```bash
cd ../core2ai && npm run build && npm link
cd ../api2ai && npm link @toolfactory.dev/core --workspace packages/cli
```

After **core2ai** rebuild, no re-sync needed — symlink/`out/` updates in place.

## Switch to registry mode (after npm publish)

From consumer root:

```bash
npm run sync:core2ai-pin:npm
# optional explicit version:
# node scripts/sync-core2ai-pin.mjs --npm 1.0.0-rc.1
```

**Verify:** lockfile `registry.npmjs.org`, **no** `"link": true`.

Commit `packages/cli/package.json`, root `package-lock.json`, `packages/extension/demos/package.json`, and `packages/extension/demos/package-lock.json` in the **release commit (CP5)** before pushing tag **CP6** — consumer CI runs on **`v*` tags only**, not on branch push.

## After core2ai changes (link mode)

| Changed in core2ai | Action |
|--------------------|--------|
| Any `src/**` | `npm run build` or `npm run watch` in **core2ai** (no re-link) |
| `src/codegen/**` | Regenerate consumers: `generate:all`, `build:generated`; restart MCP |
| Before VSIX / embed | `npm run build --workspace packages/extension` (embed bundles CLI; link alone does not refresh `out/embed-*/cli.cjs`) |

See [core2ai-build.mdc](../../rules/core2ai-build.mdc).

## Demos generate: explicit cliPath

`project-generate.config.json` sets **`cliPath`** (monorepo default: `../../cli/bin/cli.js`). `generate.mjs` uses that path or `${CLI_ENV_VAR}` — no extension-folder scan.

`createDemoWorkspace` overwrites `cliPath` with the installed VSIX embed (`out/embed-*/cli.cjs`). Hand-copied demo folders: set `cliPath` manually or recreate via the extension command.

## Release coordination

During a **core2ai** release (see [guided-release/SKILL.md](../guided-release/SKILL.md) **C1–C4**, consumer **CP1–CP7**):

1. Finish work in **link mode**
2. **C2** commit core2ai → **C3** `git tag vX.Y.Z` + push → [publish.yml](../../.github/workflows/publish.yml) (Quality Gate + npmjs)
3. **C4** confirm `npm view @toolfactory.dev/core version`
4. Consumer **CP1–CP5**: VSIX prep, manual test, release commit with `sync:core2ai-pin:npm`
5. **CP6** consumer `git tag vX.Y.Z` + push → `.github/workflows/ci.yml` (Quality Gate)
6. **CP7** `vsix:release` after CI green

Branch pushes with link lockfile are fine during dev — no consumer CI on branches.

Until step 4, keep **link mode** locally if still hacking core2ai.

## Related

- [core2ai-build.mdc](../../rules/core2ai-build.mdc) — watch/build, consumer regen
- [guided-release/SKILL.md](../guided-release/SKILL.md) — CP C pin sync at release
- Plan: [1.0-core2ai-npmjs.plan.md](../../plans/1.0-core2ai-npmjs.plan.md)
