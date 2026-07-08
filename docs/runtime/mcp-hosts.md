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
(Cursor, MCP Inspector, Claude, ...)
```

Code generation produces:

- one generated tool module per DSL file
- four shared MCP runtime modules per project (`cli/*-runtime.ts`)
- four per-module MCP server entrypoints per DSL file (`servers/<module>-<host>-mcp-server.ts`)

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
- [Shipping MCP Hosts (`build:mcp`)](#shipping-mcp-hosts-buildmcp)
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
      stdio-runtime.ts
      public-http-runtime.ts
      passthrough-http-runtime.ts
      oauth-http-runtime.ts

    servers/
      <module>-stdio-mcp-server.ts
      <module>-public-http-mcp-server.ts
      <module>-passthrough-http-mcp-server.ts
      <module>-oauth-http-mcp-server.ts
```

Each server file statically imports its tools module and delegates to the matching runtime (`runStdioMcp`, `runPublicHttpMcp`, …). There is no generic host that takes a tools path in `argv[0]`.

Generated tool modules contain:

- `invokeTool()`
- Zod schemas
- input validation
- `verifyCredential()` when authentication is enabled

The generated host files are static runtime templates emitted by `@toolfactory.dev/core/codegen`.

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

| Host entrypoint                        | Transport                   | Sessions | Typical Usage          |
| -------------------------------------- | --------------------------- | -------- | ---------------------- |
| `<module>-stdio-mcp-server`            | stdio                       | ❌       | Cursor, Claude Desktop |
| `<module>-public-http-mcp-server`      | Streamable HTTP             | ✅       | Public APIs            |
| `<module>-passthrough-http-mcp-server` | Streamable HTTP             | ✅       | Shared API keys        |
| `<module>-oauth-http-mcp-server`       | Streamable HTTP + OAuth 2.1 | ✅       | User login             |

HTTP hosts use:

```text
listen: 127.0.0.1
path: /mcp
endpoint: http://127.0.0.1:<port>/mcp
```

Each project generates four runtime modules and four server entrypoints **per DSL module**; start only the server binary your client needs (`stdio` for Cursor, HTTP for Inspector or other HTTP clients, etc.).

Unused server binaries can stay unstarted.

---

## Choosing a Host

| Scenario                 | Recommended server                     |
| ------------------------ | -------------------------------------- |
| Cursor local development | `<module>-stdio-mcp-server`            |
| Public HTTP access       | `<module>-public-http-mcp-server`      |
| Shared API keys          | `<module>-passthrough-http-mcp-server` |
| Per-user authentication  | `<module>-oauth-http-mcp-server`       |
| MCP Inspector (browser)  | HTTP servers only                      |

A project always generates all four server entrypoints per module.

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
node generated/<product>/servers/<module>-stdio-mcp-server.js \
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
node generated/<product>/servers/<module>-public-http-mcp-server.js \
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
- MCP Inspector custom headers
- team environments

### Transport

```text
Streamable HTTP
```

### Example

```bash
node generated/<product>/servers/<module>-passthrough-http-mcp-server.js \
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
- MCP Inspector OAuth tab
- enterprise deployments
- shared MCP environments

### Transport

```text
Streamable HTTP + OAuth 2.1
```

### Example

```bash
node generated/<product>/servers/<module>-oauth-http-mcp-server.js \
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

When the tools module exports `tokenExchange` (api2ai DSL `auth.hooks.tokenExchange`), the OAuth HTTP host runs **two credential layers**:

```text
Inbound Bearer (IdP JWT from Cursor OAuth)
        ↓
tokenExchange hook  →  portal/API JWT
        ↓
verifyCredential  →  session.credential = portal JWT
```

Re-exchange happens when the inbound IdP Bearer changes (new login). Later tool calls reuse the cached portal credential without calling `tokenExchange` again. Demos without `tokenExchange` (bookings, cakes, db2ai) cache the inbound Bearer directly.

See demo `banking.api2ai` (IdP on `:3860`, banking API on `:3858`, OAuth MCP on `:3873`).

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
http://localhost:8787/callback
http://localhost:6274/oauth/callback
http://localhost:6274/oauth/callback/debug
http://127.0.0.1:6274/oauth/callback
http://127.0.0.1:6274/oauth/callback/debug
```

Configured using:

```text
OAUTH_IDP_REDIRECT_URIS
```

### Browser CORS

Browser clients (MCP Inspector OAuth tab) call the MCP host and IdP cross-origin. CORS is controlled by:

```text
MCP_HTTP_CORS_ORIGIN
```

- **Set:** fixed `Access-Control-Allow-Origin` (e.g. `http://localhost:6274` for Inspector).
- **Unset:** reflect the request `Origin` header when present (typical for local demos).
- No `*` fallback — curl and same-origin clients do not need CORS headers.

Applies to the oauth HTTP host (codegen) and demo IdPs (`oauth-idp/server.mjs`).

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
| MCP Inspector  | —              | URL     | URL + headers | URL + OAuth |
| Claude Desktop | native         | limited | limited       | limited     |

---

## Running Demo Hosts

Demo workspaces start MCP hosts with **foreground** as the default: each host prints a startup banner (via `loggingAdapter.banner()`), and the terminal stays attached until Ctrl+C.

| Workspace | MCP (`start:mcp`, alias `start`) — foreground | Full stack (`start:all`) — foreground | Fixtures only (`start:fixtures`) — background |
| --------- | --------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| api2ai    | `npm run start` / `npm run start:mcp`         | `npm run start:all`                   | `npm run start:fixtures`                      |
| db2ai     | `npm run start` / `npm run start:mcp`         | `npm run start:all`                   | `npm run start:fixtures`                      |

The orchestrator prints a short summary (`printStartMcpSummary`) after MCP hosts start.

### api2ai

```bash
npm run build:generated
npm run start:all    # full stack (/test-all, fresh clone)
npm run start:mcp    # MCP only after fixtures are up (alias: npm run start)
npm run start:fixtures   # mock APIs / DBs only (background)
```

### db2ai

```bash
npm run build:generated
npm run start:all    # full stack (/test-all, fresh clone)
npm run start:mcp    # MCP only after DBs/IdP are up (alias: npm run start)
npm run start:fixtures   # Docker DBs + IdP only (background)
```

Ports and URLs are configured in:

- `.cursor/mcp.json`
- `.env`

---

## Shipping MCP Hosts (`build:mcp`)

Demo workspaces can bundle **one module + one host type** into a shippable folder under `dist/mcp/`.

Prerequisites:

```bash
npm run build:generated
```

Build one package (api2ai demos example):

```bash
npm run build:mcp -- --host public-http spaceflight-news
```

Build helpers live in `scripts/generated/build-mcp-lib.mjs` (regenerated from `core2ai` on `generate:all`). The hand-maintained entrypoint is `scripts/build-mcp.mjs`.

Output layout:

```text
dist/mcp/<module>-<host>/
  server.mjs          # esbuild bundle (ESM, hooks + runtime included)
  package.json        # runtime deps + scripts.start (demo CLI flags)
  .env.example        # env keys for this demo (no secrets)
  mcp.json.example    # Cursor HTTP/OAuth snippet
```

Run the shipped host:

```bash
cd dist/mcp/spaceflight-news-public-http
npm install
cp .env.example .env
npm start
```

`npm start` runs `server.mjs` with the flags from the demo map (e.g. `--base-url-env SPACEFLIGHT_NEWS_BASE_URL --port … --path /mcp`). Values are read from `.env`; only env **names** are fixed in `package.json`.

**Notes:**

- One `build:mcp` invocation = exactly one `--host` + one module name.
- Secrets are never embedded; only variable names appear in `.env.example`.
- **OAuth** (e.g. `bookings`): the bundle contains the **MCP host only**. Mock API, database, and OAuth IdP are **external** — configure their URLs in `.env`. The demo `npm start` script may include a default `--oauth-idp-url` from `.env.example`; change it for your deployment IdP.
- db2ai bundles add the matching database driver (`pg`, `mysql2`, …) to `package.json`.
- `dist/mcp/` is gitignored; ship the folder contents (zip, image, copy).

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
src/codegen/render-stdio-runtime.ts
src/codegen/render-http-mcp-server.ts
src/codegen/render-oauth-http-mcp-server.ts
src/codegen/mcp-module-host.ts
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
