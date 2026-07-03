# MCP Hosts

[← Documentation index](../README.md)

MCP hosts are the runtime processes that expose generated tools to AI clients over the Model Context Protocol (MCP).

Within the `core2ai` architecture they sit between **Layer 2 (Tool Authoring)** and **Layer 3 (AI Runtime)**:

```text
.api2ai / .db2ai
        ↓
generated *-tools.ts
        ↓
MCP host
        ↓
AI client
(Cursor, Open WebUI, Claude, ...)
```

Code generation produces:

- one generated tool module per DSL file
- four MCP host runtimes per project

The generated hosts are **standalone runtimes** emitted by `core2ai`.

At runtime they depend only on:

- `@modelcontextprotocol/sdk`
- `zod`

No runtime dependency on `core2ai` exists after generation.

---

## Contents

- [Generated Files](#generated-files)
- [Host Overview](#host-overview)
- [Choosing a Host](#choosing-a-host)
- [Shared Runtime Behavior](#shared-runtime-behavior)
- [stdio MCP Host](#stdio-mcp-host)
- [public HTTP MCP Host](#public-http-mcp-host)
- [passthrough HTTP MCP Host](#passthrough-http-mcp-host)
- [OAuth HTTP MCP Host](#oauth-http-mcp-host)
- [api2ai vs db2ai](#api2ai-vs-db2ai)
- [Client Configuration Summary](#client-configuration-summary)
- [Running Demo Hosts](#running-demo-hosts)
- [Troubleshooting](#troubleshooting)
- [Implementation Reference](#implementation-reference)

---

## Generated Files

After generation or saving a DSL file in the VSIX extension:

```text
generated/
  <product>/
    tools/
      <module>-tools.ts

    cli/
      stdio-mcp-server.ts
      public-http-mcp-server.ts
      passthrough-http-mcp-server.ts
      oauth-http-mcp-server.ts
```

Generated tool modules contain:

- `invokeTool()`
- Zod schemas
- input validation
- `verifyCredential()` when authentication is enabled

The generated host files are static runtime templates emitted by `@core2ai/core/codegen`.

Compile TypeScript output before running:

```bash
npm run build:generated
```

or

```bash
tsc
```

---

## Host Overview

| Host                          | Transport                   | Sessions | Typical Usage          |
| ----------------------------- | --------------------------- | -------- | ---------------------- |
| `stdio-mcp-server`            | stdio                       | ❌       | Cursor, Claude Desktop |
| `public-http-mcp-server`      | Streamable HTTP             | ✅       | Public APIs            |
| `passthrough-http-mcp-server` | Streamable HTTP             | ✅       | Shared API keys        |
| `oauth-http-mcp-server`       | Streamable HTTP + OAuth 2.1 | ✅       | User login             |

HTTP hosts use:

```text
listen: 127.0.0.1
path: /mcp
endpoint: http://127.0.0.1:<port>/mcp
```

Each project generates four host binaries; start only the one your client needs (`stdio` for Cursor, HTTP for Open WebUI, etc.).

The remaining host binaries can stay unused.

---

## Choosing a Host

| Scenario                 | Recommended Host              |
| ------------------------ | ----------------------------- |
| Cursor local development | `stdio-mcp-server`            |
| Public HTTP access       | `public-http-mcp-server`      |
| Shared API keys          | `passthrough-http-mcp-server` |
| Per-user authentication  | `oauth-http-mcp-server`       |
| Open WebUI               | HTTP hosts only               |

A project always generates all four host runtimes.

The application decides which host binary to start and how clients connect to it.

---

## Shared Runtime Behavior

Generated hosts are MCP **tool servers** and currently implement:

- `tools/list`
- `tools/call`

The following MCP capabilities are intentionally not implemented:

- Resources
- Prompts
- Sampling

The generated runtimes focus exclusively on exposing curated tools.

All four hosts share the same runtime pipeline.

At startup they:

1. Load `.env` (optional `.env.local` overrides for local experiments).
2. Import the generated tools module.
3. Validate startup configuration.
4. Register generated tools on an MCP server.
5. Start listening for MCP requests.

On each tool invocation the host creates a host context and forwards it to:

```text
invokeTool(toolName, args, hostContext)
```

### api2ai Host Context

Typical fields include:

- `baseUrl`
- `credential`
- `upstreamCredential`
- `credentials`

`baseUrl` usually comes from:

```text
--base-url-env API_BASE_URL
```

### db2ai Host Context

Typical fields include:

- `connectionString`
- `databaseDialect`
- `credential`
- `upstreamCredential`

Database connections are typically configured via:

```text
connectionEnv
```

inside the `.db2ai` file.

### Authentication

Credential validation does not happen inside the host.

The host only forwards credentials.

Validation is implemented in product hooks:

```text
src/hooks/api2ai/...
src/hooks/db2ai/...
```

and exported as:

```text
verifyCredential()
```

from the generated tools module.

---

## stdio MCP Host

### Best for

- Cursor
- Claude Desktop
- local development

### Transport

```text
StdioServerTransport
```

One long-running Node.js process communicates via stdin/stdout JSON-RPC.

### Example

```bash
node generated/<product>/cli/stdio-mcp-server.js \
  generated/<product>/tools/<module>-tools.js \
  --base-url-env API_BASE_URL \
  --auth-env GITHUB_TOKEN
```

### Credential Flow

1. The host reads credentials from environment variables.
2. Credentials are injected into `hostContext`.
3. Tool calls reuse the same credential.

If authentication is required and `--auth-env` is missing, startup fails.

### db2ai Note

If the generated module exports `connectionEnv`, the database connection string is loaded from that environment variable instead of `--base-url-env`.

---

## public HTTP MCP Host

### Best for

- public APIs
- local demos
- unauthenticated access

### Transport

```text
StreamableHTTPServerTransport
```

Supports stateful MCP sessions.

### Example

```bash
node generated/<product>/cli/public-http-mcp-server.js \
  generated/<product>/tools/<module>-tools.js \
  --base-url-env API_BASE_URL \
  --port 3849
```

### Authentication

- no MCP authentication headers
- no client credentials
- credentials come only from host configuration

### Sessions

Clients create sessions via:

```text
initialize
```

Subsequent requests use:

```text
mcp-session-id
```

---

## passthrough HTTP MCP Host

### Best for

- shared API keys
- Open WebUI custom headers
- team environments

### Transport

```text
Streamable HTTP
```

### Example

```bash
node generated/<product>/cli/passthrough-http-mcp-server.js \
  generated/<product>/tools/<module>-tools.js \
  --base-url-env API_BASE_URL \
  --port 3853
```

### Credential Flow

Priority order:

1. Client header
2. Host environment variable

Header name defaults to:

```text
x-api-token
```

and can be configured using:

```text
MCP_AUTH_HEADER
```

Fallback credentials may come from:

```text
--auth-env
```

### Cursor Example

```json
{
    "mcpServers": {
        "todo": {
            "url": "http://127.0.0.1:3853/mcp",
            "headers": {
                "x-api-token": "demo-todo-api-key"
            }
        }
    }
}
```

---

## OAuth HTTP MCP Host

### Best for

- user login
- Open WebUI
- enterprise deployments
- shared MCP environments

### Transport

```text
Streamable HTTP + OAuth 2.1
```

### Example

```bash
node generated/<product>/cli/oauth-http-mcp-server.js \
  generated/<product>/tools/<module>-tools.js \
  --base-url-env API_BASE_URL \
  --oauth-idp-url http://127.0.0.1:3861 \
  --oauth-scope bookings \
  --port 3872
```

### Authentication

Credentials come from:

```text
Authorization: Bearer ...
```

after OAuth login.

No `--auth-env` is used.

### Session Flow

1. Client connects.
2. OAuth login is performed.
3. Bearer token is validated.
4. Credential is stored for the MCP session.
5. Subsequent tool calls reuse the session credential.

### Cursor Example

```json
{
    "mcpServers": {
        "bookings": {
            "url": "http://127.0.0.1:3872/mcp",
            "auth": {
                "CLIENT_ID": "mcp-demo-local"
            }
        }
    }
}
```

### Redirect Allowlist

Example:

```text
cursor://anysphere.cursor-mcp/oauth/callback
http://localhost:3000/oauth/clients/mcp:*
http://127.0.0.1:3000/oauth/clients/mcp:*
```

Configured using:

```text
OAUTH_IDP_REDIRECT_URIS
```

---

## api2ai vs db2ai

| Topic      | api2ai             | db2ai             |
| ---------- | ------------------ | ----------------- |
| Upstream   | REST API           | SQL database      |
| Startup    | `--base-url-env`   | `connectionEnv`   |
| Auth hooks | `src/hooks/api2ai` | `src/hooks/db2ai` |
| Demo ports | 38xx               | 48xx              |

Typical db2ai demo mappings:

- `sakila-mysql` → passthrough
- `pagila-postgresql` → passthrough
- `animals-sqlserver` → public
- `plants-oracle` → public
- `orders-postgresql` → OAuth

Credential validation, authorization, and request preparation are implemented using runtime hooks.

See [Auth and Hooks](../authoring/auth-and-hooks.md) for details.

---

## Client Configuration Summary

| Client         | stdio          | public  | passthrough   | OAuth       |
| -------------- | -------------- | ------- | ------------- | ----------- |
| Cursor         | command + args | URL     | URL + headers | URL + OAuth |
| Open WebUI     | MCPO only      | native  | native        | native      |
| Claude Desktop | native         | limited | limited       | limited     |

---

## Running Demo Hosts

### api2ai

```bash
npm run build:generated
npm run start
```

### db2ai

```bash
npm run build:generated
npm run start:all
```

Ports and URLs are configured in:

- `.cursor/mcp.json`
- `.env`

---

## Troubleshooting

| Error                                     | Likely Cause                                        |
| ----------------------------------------- | --------------------------------------------------- |
| `Required: --base-url-env`                | Missing flag or missing environment variable        |
| `pass --auth-env on stdio`                | Authentication enabled but no credential configured |
| `verifyCredential is not exported`        | Missing auth hook                                   |
| Missing database connection               | `connectionEnv` not configured                      |
| Session not found                         | Stale `mcp-session-id`                              |
| `401` during OAuth initialization         | OAuth login not completed                           |
| Verify Connection succeeds but tools fail | Invalid credentials or upstream service unavailable |

---

## Implementation Reference

Host templates live inside `core2ai`:

```text
src/codegen/render-stdio-mcp-server.ts
src/codegen/render-http-mcp-server.ts
src/codegen/render-oauth-http-mcp-server.ts
src/codegen/render-mcp-host-shared.ts
src/codegen/mcp-host-product-runtime.ts
```

After changing host templates:

1. Rebuild `core2ai`
2. Rebuild the consumer project
3. Regenerate tool code
4. Restart MCP clients

---

## See Also

- [Documentation index](../README.md)
- [Cursor Integration](../integrations/cursor.md)
- [Open WebUI Integration](../integrations/open-webui.md)
- [MCP Inspector](../testing/mcp-inspector.md)
- [Layer 2 — Tool Authoring](../architecture/02-layer-2-tool-authoring.md)
- [Layer 3 — AI Runtime](../architecture/03-layer-3-ai-runtime.md)
- [Auth and Hooks](../authoring/auth-and-hooks.md)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
