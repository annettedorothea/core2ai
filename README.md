# core2ai

Shared package for api2ai and db2ai.

| Package             | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `@core2ai/codegen`  | Generated-output bootstrap (placeholder)                    |
| `@core2ai/mcp-host` | Generic MCP stdio host + `mcp-standalone-entry` for esbuild |

The repository root is installable as `@core2ai/core`, so consumers can reference the GitHub repository directly after a tag or branch is pushed:

```json
{
    "dependencies": {
        "@core2ai/core": "github:annettedorothea/core2ai#main"
    }
}
```

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

_Created with gratitude to Jesus Christ._
