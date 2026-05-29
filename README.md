# core2ai

Shared package for api2ai and db2ai.

| Package             | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `@core2ai/codegen`  | Generated-output bootstrap (placeholder)                    |
| `@core2ai/mcp-host` | Generic MCP stdio host + `mcp-standalone-entry` for esbuild |

The repository root is installable as `@core2ai/core`. **Consumers should pin an explicit Git tag** (not `main`) for reproducible installs:

```json
{
    "dependencies": {
        "@core2ai/core": "github:annettedorothea/core2ai#v0.0.2"
    }
}
```

After publishing a new tag in this repo:

1. Edit **`scripts/core2ai-pin.json`** here (tag + `spec`).
2. In **api2ai** / **db2ai**: `npm run core2ai:apply-pin` (uses scripts from installed `@core2ai/core` + local `core2ai-pin.targets.json`).
3. `npm run install:github-https` in each consumer repo.

Show pin: `npm run core2ai:pin` (from core2ai or any consumer with `@core2ai/core` installed).

Use subpath imports from consumers:

```ts
import { extractAstNode } from '@core2ai/core/codegen';
import { readGeneratedModule } from '@core2ai/core/mcp-host';
```

## Build

```bash
npm install
npm run build
```

Rebuild core2ai before rebuilding a consumer after host changes.

## Checks

- `npm run check` runs format, typecheck, and lint only.
- `npm test` runs all package test suites.

## Git Hooks

`postinstall` does not install hooks automatically. This keeps `@core2ai/core` safe to install as a GitHub dependency in consumer projects without mutating their `.git/hooks`.

For local development in this repository, install the pre-commit hook explicitly:

```bash
npm run install:hooks
```

---

#Col3:23
