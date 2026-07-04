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

Commit `packages/cli/package.json` + `package-lock.json` before CI expects registry.

## After core2ai changes (link mode)

| Changed in core2ai | Action |
|--------------------|--------|
| Any `src/**` | `npm run build` or `npm run watch` in **core2ai** (no re-link) |
| `src/codegen/**` | Regenerate consumers: `generate:all`, `build:generated`; restart MCP |
| Before VSIX / embed | `npm run build --workspace packages/extension` (embed bundles CLI; link alone does not refresh `out/embed-*/cli.cjs`) |

See [core2ai-build.mdc](../../rules/core2ai-build.mdc).

## Demos generate: live CLI vs embed

`packages/extension/demos/scripts/generate.mjs` must prefer **`packages/cli/bin/cli.js`** (live monorepo CLI) over `packages/extension/out/embed-*/cli.cjs` while hacking codegen. Stale embed → old generated hook maps even when link mode is correct.

## Release coordination

During a **core2ai** breaking codegen release:

1. Finish work in **link mode**
2. Publish `@toolfactory.dev/core` (tag → `publish.yml`)
3. Both consumers: `npm run sync:core2ai-pin:npm` → commit lockfiles
4. Then VSIX / CI use registry

Until step 3, keep **link mode** locally.

## Related

- [core2ai-build.mdc](../../rules/core2ai-build.mdc) — watch/build, consumer regen
- [guided-release/SKILL.md](../guided-release/SKILL.md) — CP C pin sync at release
- Plan: [1.0-core2ai-npmjs.plan.md](../../plans/1.0-core2ai-npmjs.plan.md)
