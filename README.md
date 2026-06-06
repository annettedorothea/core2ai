# core2ai

**core2ai** is the shared **codegen** library for **api2ai** and **db2ai**: document validation, auth-stub bootstrap, Zod codegen, and static MCP stdio host source (`renderStdioMcpServerSource`).

| Subpath export          | Purpose                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `@core2ai/core/codegen` | Document validation, auth-stub bootstrap, Zod codegen, MCP project bootstrap, demo test emit |

The repository root is **`@core2ai/core`**. Package exports resolve to compiled **`out/`**, not `src/`. The package is **not published to npm** — local development uses **`npm link`** against a sibling checkout.

```ts
import { assertDocumentValidForGenerate } from '@core2ai/core/codegen';
```

Generated demo/runtime MCP host code lives in each consumer’s **`generated/cli/stdio-mcp-server.ts`** (no `@core2ai/core` at runtime).

Source layout:

```
src/codegen/       — shared generator helpers (incl. render-stdio-mcp-server.ts, writeGeneratedDemosTestSupport)
src/test-fixtures/ — render-* templates for consumer demos/test/generated (emitted on generate:all)
```

Demo integration tests import committed `test/generated/` in each consumer — not `@core2ai/core`.

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
./core2ai
./api2ai   (or db2ai)
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

| What changed                                     | In consumer                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **codegen** (incl. `renderStdioMcpServerSource`) | `generate:all`, `build:generated` in demos when MCP bootstrap shape changed; **restart MCP** in Cursor |
| **VSIX / extension embed**                       | `npm run build` in `packages/extension` — embed bundles CLI separately from link                       |

## Git hooks

[Husky](https://typicode.github.io/husky/) runs **`npm run check`** on pre-commit (via `postinstall`). Re-init after clone: `npx husky`. In **api2ai** and **db2ai**, pre-commit also runs **`npm run test`**.

---

#Col3:23
