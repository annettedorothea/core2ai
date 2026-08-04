# VS Code / GitHub Copilot Integration

[← Documentation index](../README.md)

VS Code with GitHub Copilot (**Agent** mode) can use the same generated MCP servers as Cursor.

Official MCP docs:

https://code.visualstudio.com/docs/copilot/customization/mcp-servers

---

## Demo workspaces (stdio only)

In the **api2ai** / **db2ai** demo workspaces, use **stdio** only for now:

1. `npm run start:all:vscode` (backends/fixtures; no HTTP MCP hosts)
2. Open [`.vscode/mcp.json`](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) or the MCP view and **start** the listed servers
3. Copilot Chat in **Agent** mode

**Today:** Streamable HTTP / OAuth MCP against these demos is **not** reliable in Copilot (session/auth and tool use). Prefer **stdio** here; use [Cursor](cursor.md) for the HTTP / OAuth demo path (`.cursor/mcp.json` + `npm run start:all`).

Config shape differs from Cursor: top-level `servers`, each entry needs `"type": "stdio"`, plus `command` / `args` / optional `envFile`.

---

## See Also

- [Documentation index](../README.md)
- [Cursor Integration](cursor.md)
- [MCP Hosts](../runtime/mcp-hosts.md)
- [Layer 3 — AI Runtime](../architecture/03-layer-3-ai-runtime.md)
- [api2ai Demo Workspace](https://github.com/annettedorothea/api2ai/tree/main/packages/extension/demos)
- [db2ai Demo Workspace](https://github.com/annettedorothea/db2ai/tree/main/packages/extension/demos)

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
