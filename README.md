# core2ai

Shared packages for api2ai and db2ai.

| Package             | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `@core2ai/codegen`  | Generated-output bootstrap (placeholder)                    |
| `@core2ai/mcp-host` | Generic MCP stdio host + `mcp-standalone-entry` for esbuild |

## Build

```bash
npm install
npm run build
```

Rebuild core2ai before rebuilding a consumer after host changes.

## Checks

- `npm run check` runs format, typecheck, and lint only.
- `npm test` runs all package test suites.

---

_Created with gratitude to Jesus Christ._
