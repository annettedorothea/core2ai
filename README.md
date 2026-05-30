# core2ai

**core2ai** is the shared library for **api2ai** and **db2ai**: MCP stdio host runtime and codegen helpers used by both CLIs and generated demo workspaces.

| Subpath export                            | Purpose                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `@core2ai/core/codegen`                   | Document validation, auth-stub bootstrap, Zod codegen, MCP project bootstrap |
| `@core2ai/core/mcp-host`                  | Generic MCP stdio host (`readGeneratedModule`, env loading, smoke helper)    |
| `@core2ai/core/mcp-host/standalone-entry` | Entry used by generated `mcp-serve.*` and the VSIX embed                     |

The repository root is **`@core2ai/core`**. Package exports resolve to compiled **`out/`**, not `src/`. The package is **not published to npm** — local development uses **`npm link`** against a sibling checkout.

```ts
import { assertDocumentValidForGenerate } from '@core2ai/core/codegen';
import { readGeneratedModule } from '@core2ai/core/mcp-host';
```

Source layout:

```
src/codegen/   — shared generator helpers
src/mcp-host/  — MCP stdio host + standalone entry
scripts/       — consumer-dev-smoke.mjs (called from api2ai/db2ai dev-smoke scripts)
```

## Docs

Architecture and layers: [**docs/README.md**](./docs/README.md)

## Build

```bash
npm install   # prepare → npm run build (creates out/)
npm run check
```

While editing **`src/`**, keep **`out/`** current so linked consumers pick up changes:

```bash
npm run watch
```

Run **`watch`** in a dedicated terminal during active core2ai work. For a one-off change, **`npm run build`** is enough.

If **`out/`** looks stale (renamed/deleted files), delete the folder manually and run **`npm run build`** again.

## npm link (api2ai / db2ai)

Sibling layout:

```
MCP/core2ai
MCP/api2ai   (or db2ai)
```

One-time setup per machine:

```bash
# core2ai
npm install
npm link

# api2ai or db2ai — from consumer repo root
cd packages/cli && npm link @core2ai/core && cd ../..
npm install
cd packages/extension/demos && npm link @core2ai/core && npm install
```

Verify:

```bash
ls -l packages/cli/node_modules/@core2ai/core          # → …/core2ai
ls -l packages/extension/demos/node_modules/@core2ai/core
```

No need to re-link after core2ai rebuilds — the symlink stays; only **`out/`** must be up to date.

### After core2ai changes

| What changed               | In consumer                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| **codegen**                | Usually nothing beyond core2ai `build`/`watch` — CLI loads linked `out/codegen` on next run      |
| **mcp-host**               | `generate:all`, `build:generated` in demos if bootstrap shape changed; **restart MCP** in Cursor |
| **VSIX / extension embed** | `npm run build` in `packages/extension` — embed bundles core2ai separately from link             |

## Git hooks

[Husky](https://typicode.github.io/husky/) runs **`npm run check`** on pre-commit (via `postinstall`). Re-init after clone: `npx husky`.

---

#Col3:23
