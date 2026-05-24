# @core2ai/mcp-host

Generic MCP stdio host for generated `*-tools.mjs` modules.

## Generated module contract

Each DSL generator must export:

| Export | Purpose |
|--------|---------|
| `mcpHostAdapter` | `configureFromArgv`, `validateAtStartup`, `resolveHostContext`, `envDirsForReload` |
| `generatedTools` | Tool list for MCP registration |
| `inputZodByTool` | Zod input schema per tool |
| `invokeTool` | Domain runtime (HTTP, SQL, …) |
| `mcpServerName`, `mcpServerVersion` | MCP server identity |
| `requiresAuth` | Optional startup validation hint |

Host API: `readGeneratedModule`, `runMcpServer`, `loadLocalEnvFiles`.

Standalone bundle entry: `src/mcp-standalone-entry.ts` (esbuild → `mcp-serve.mjs` in consumer projects).
