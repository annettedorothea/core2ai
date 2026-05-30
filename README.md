# core2ai

**core2ai** provides the shared foundation for **api2ai** and **db2ai**: common MCP runtime components, code generation infrastructure, extension utilities, and reusable abstractions used across both projects. It enables consistent tool generation while avoiding duplication between implementations.

| Package             | Purpose                                                         |
| ------------------- | --------------------------------------------------------------- |
| `@core2ai/codegen`  | Generate validation, auth-stub bootstrap, MCP project bootstrap |
| `@core2ai/mcp-host` | Generic MCP stdio host + `mcp-standalone-entry` for esbuild     |

The repository root is installable as `@core2ai/core`. **Consumers pin an explicit Git tag** (not `main`):

```json
{
    "dependencies": {
        "@core2ai/core": "github:annettedorothea/core2ai#v0.0.5"
    }
}
```

After publishing a new tag here:

1. Edit **`scripts/core2ai-pin.json`** (tag + `spec`).
2. In **api2ai** / **db2ai**: **`npm run core2ai:use-pin`** (sync manifests, force reinstall, refresh lockfile).
    - Pin source: sibling **`../core2ai/scripts`** when present, else installed `@core2ai/core`, else `CORE2AI_PIN_SOURCE`.
3. api2ai only: `npm run install:demos` if demos still resolve an old commit.
4. Both consumers: `npm run bundle:mcp-runtime`, `npm run generate:all`, `npm run build`, `npm run check`.

Local development against sibling core2ai: **`npm run core2ai:use-local`** in the consumer (commits OK; **push** requires **`core2ai:use-pin`**).

Show pin: `npm run core2ai:pin`. If GitHub SSH fails: **`install:github-https`**.

Subpath imports:

```ts
import { assertDocumentValidForGenerate } from '@core2ai/core/codegen';
import { readGeneratedModule } from '@core2ai/core/mcp-host';
```

## Docs

Architecture, layers, and consumer workflows: [**docs/README.md**](./docs/README.md)

## Build

```bash
npm install
npm run build
npm run check
```

Rebuild core2ai before rebuilding a consumer after host or codegen changes.

## Git hooks

`postinstall` does not install hooks (safe for GitHub dependency installs). For local work in this repo:

```bash
npm run install:hooks
```

---

#Col3:23
