# Auth and hooks

[← Documentation index](../README.md)

How credentials, upstream API auth, and programmatic authorization fit together in **api2ai** and **db2ai**.

## Contents

- [Three layers](#three-layers-do-not-confuse-them)
- [Runtime sequence](#runtime-sequence-protected-tool)
- [Generated pipeline tiers](#generated-pipeline-tiers)
- [Hook file layout](#hook-file-layout)
- [DSL hooks block](#dsl-hooks-block)
- [Validator rules](#validator-rules-editor)
- [Demo references](#demo-references)

See also: [api2ai DSL](./api2ai-dsl.md), [db2ai DSL](./db2ai-dsl.md), [MCP hosts](../runtime/mcp-hosts.md).

---

## Three layers (do not confuse them)

| Layer                              | What it is                                                      | Where configured                                                |
| ---------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| **1. MCP host auth**               | How the AI client authenticates **to your MCP server**          | `mcp.json`, stdio `--auth-env`, HTTP `x-api-token`, OAuth login |
| **2. Upstream auth (api2ai only)** | How the generated HTTP client authenticates **to the REST API** | `auth { in, name, prefix }` in `.api2ai`                        |
| **3. Hooks**                       | Programmatic rules: verify token, allow/deny, inject params     | `src/hooks/...` TypeScript files                                |

**db2ai** has no upstream `auth { }` block — only the `auth` keyword to enable layer 1 + 3 for protected SQL tools. Database URLs stay in environment variables.

---

## Runtime sequence (protected tool)

```text
MCP tools/call (credential from client)
        ↓
tokenExchange      ← optional module hook (api2ai only); IdP JWT → portal/API credential
        ↓
verifyCredential   ← optional module hook; validate raw credential string (void)
        ↓
checkToolAccess    ← optional per-tool hook; throw to deny (403)
        ↓
prepareToolCall    ← optional per-tool hook; reshape options (query, path, body, bind params)
        ↓
HTTP request or SQL execute
```

On **OAuth HTTP** hosts, `tokenExchange` (when declared) runs once per MCP session inside `resolveOAuthSessionCredential` before `verifyCredential`. The exchanged credential is cached for later tool calls. Demos without `tokenExchange` keep the inbound Bearer token (bookings, cakes).

Public tools (`access: public`) skip credential requirements. `prepareToolCall` may still run on public tools (for example SQL limit capping) without a credential parameter.

---

## Generated pipeline tiers

`@toolfactory.dev/core` emits one of three invoke shapes:

| Tier         | When                                                 | What runs                                  |
| ------------ | ---------------------------------------------------- | ------------------------------------------ |
| `none`       | No `auth`, all public                                | Direct HTTP/SQL                            |
| `credential` | `auth` + protected tools, no per-tool hooks          | `verifyCredential` + upstream header/query |
| `full`       | Any tool with `checkToolAccess` or `prepareToolCall` | Full chain above                           |

---

## Hook file layout

After generation, hand-written hooks live beside the demo/project workspace:

```text
src/hooks/api2ai/<module>-tools/
    verifyGithubCredential.ts              ← when auth.hooks.verifyCredential (api2ai)
    checkToolAccessForListBookings.ts      ← one file per hook export (write-once)
    prepareToolCallForListBookings.ts

src/hooks/db2ai/<module>-tools/
    verifyPagilaPostgresqlCredential.ts    ← when auth keyword present (db2ai)
    prepareToolCallForListActors.ts        ← filename matches export function name
```

| DSL declaration                        | Generated import / map           | Typical export                                                           |
| -------------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| `auth { hooks: { verifyCredential } }` | `verifyCredential`               | `verifyXCredential` (re-exported as `verifyCredential`)                  |
| `auth { hooks: { tokenExchange } }`    | `tokenExchange`                  | `tokenExchangeXCredential` (re-exported as `tokenExchange`; api2ai only) |
| `auth` keyword (db2ai)                 | `verifyCredential`               | `verifyXCredential` (re-exported as `verifyCredential`)                  |
| `hooks: { checkToolAccess: true }`     | `checkToolAccessHooks[toolName]` | `checkToolAccessForToolName(credential)`                                 |
| `hooks: { prepareToolCall: true }`     | `prepareToolCallHooks[toolName]` | `prepareToolCallForToolName(options)` or `(options, credential)`         |

Stub files are created on first generate; implement logic, then regenerate (imports are wired automatically).

### verifyCredential contract

- **Input:** raw `credential: string` from the MCP host (no `ModuleCredentials` wrapper).
- **Output:** `Promise<void>` — throw to reject; no return value.
- **Optional:** modules may omit a verify stub when JWT or token checks live entirely in `checkToolAccess` / `prepareToolCall` (demos `bookings`, `cakes`).

---

## DSL hooks block

Per operation (api2ai) or SQL block (db2ai):

```text
hooks: {
    checkToolAccess: true
    prepareToolCall: true
}
```

Or enable only one hook:

```text
hooks: {
    prepareToolCall: true
}
```

### prepareToolCall and clientMayOmit

Mark MCP parameters the client may omit; the hook fills defaults (often from the credential):

```text
hooks: {
    prepareToolCall: {
        clientMayOmit: [customerId]
    }
}
```

Omitted keys are **optional in the generated MCP JSON Schema** but may still be required at SQL/HTTP execution time after `prepareToolCall` runs.

**db2ai:** `clientMayOmit` entries must match names in the block’s `params: { … }` map.

**api2ai:** `clientMayOmit` entries refer to OpenAPI parameter names for that operation.

### api2ai upstream `auth { }`

```text
auth {
    in: header
    name: "Authorization"
    prefix: "Bearer "
    hooks: {
        verifyCredential: true
    }
}
```

Optional **token exchange** (api2ai OAuth HTTP only):

```text
auth {
    in: header
    name: "Authorization"
    prefix: "Bearer "
    hooks: {
        tokenExchange: true
        verifyCredential: true
    }
}
```

`tokenExchange` requires `verifyCredential: true`. The host exchanges the inbound IdP Bearer once per session, then `verifyCredential` and `checkToolAccess` run on the portal/API credential.

On protected tools, `invokeTool` sets `requestHeaders[name]` or `url.searchParams` from the resolved credential after `verifyCredential` (when declared).

**Query auth example** (demo `test.api2ai`):

```text
auth {
    in: query
    name: "api_key"
    prefix: ""
    hooks: {
        verifyCredential: true
    }
}
```

---

## db2ai `auth` keyword

Bare keyword (typical):

```text
auth
```

Or with explicit verify stub generation:

```text
auth {
    hooks: {
        verifyCredential: true
    }
}
```

Enables credential checks for `access: protected` SQL tools. Connection strings are **not** passed through MCP — they remain in `database … env "VAR"`.

---

## Validator rules (editor)

| Rule                                       | Severity      | Product        |
| ------------------------------------------ | ------------- | -------------- |
| `auth` set, all tools `public`             | warning       | api2ai + db2ai |
| `database` env var not set                 | warning       | db2ai          |
| SQL `:placeholders` without `params` block | error         | db2ai          |
| Cookie / unsupported param styles          | error/warning | api2ai         |
| `clientMayOmit` references unknown param   | error         | api2ai + db2ai |

---

## MCP host credential sources

| Host             | Credential source                                                                 |
| ---------------- | --------------------------------------------------------------------------------- |
| stdio            | `--auth-env VAR` (reads from process env)                                         |
| passthrough HTTP | Client header (e.g. `x-api-token`) forwarded as MCP credential                    |
| OAuth HTTP       | Bearer token after MCP OAuth login in Cursor                                      |
| public HTTP      | No MCP credential; upstream may still use API keys from env on the server process |

---

## Demo references

| Demo                      | Pattern                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `todo.api2ai`             | passthrough header + `verifyCredential`                              |
| `test.api2ai`             | query `api_key` + protected route                                    |
| `bookings.api2ai`         | OAuth MCP + `checkToolAccess` + `prepareToolCall`                    |
| `banking.api2ai`          | OAuth MCP + `tokenExchange` + `verifyCredential` + `checkToolAccess` |
| `cakes.api2ai`            | OAuth MCP + JWT in hooks (no module verify stub)                     |
| `spaceflight-news.api2ai` | public `prepareToolCall` + `clientMayOmit` on `limit`                |
| `orders-postgresql.db2ai` | protected SQL + `checkToolAccess` + `clientMayOmit`                  |
| `pagila-postgresql.db2ai` | public `prepareToolCall` (SQL limit cap)                             |

---

## Tool servers only

Generated MCP hosts implement **`tools/list`** and **`tools/call`**. Resources, prompts, and sampling are not implemented.

---

## See also

- [Documentation index](../README.md)
- [Layer 2 – Tool Authoring](../architecture/02-layer-2-tool-authoring.md)

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
