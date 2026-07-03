# Auth and hooks

[← Documentation index](../README.md)

How credentials, upstream API auth, and programmatic authorization fit together in **api2ai** and **db2ai**.

## Contents

- [Three layers](#three-layers-do-not-confuse-them)
- [Runtime sequence](#runtime-sequence-protected-tool)
- [Generated pipeline tiers](#generated-pipeline-tiers)
- [Hook file layout](#hook-file-layout)
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
verifyCredential   ← optional module hook; map MCP token → upstream secret / DB context
        ↓
authorize          ← per-tool hook; throw to deny (403)
        ↓
prepare            ← per-tool hook; reshape optionsResolved (query, path, body, bind params)
        ↓
HTTP request or SQL execute
```

Public tools (`access: public`) skip credential requirements unless a hook is mistakenly declared without protection.

---

## Generated pipeline tiers

`@core2ai/core` emits one of three invoke shapes:

| Tier         | When                                           | What runs                                  |
| ------------ | ---------------------------------------------- | ------------------------------------------ |
| `none`       | No `auth`, all public                          | Direct HTTP/SQL                            |
| `credential` | `auth` + protected tools, no authorize/prepare | `verifyCredential` + upstream header/query |
| `full`       | Any tool with `authorize` or `prepare`         | Full chain above                           |

---

## Hook file layout

After generation, hand-written hooks live beside the demo/project workspace:

```text
src/hooks/api2ai/<module>-tools/
    verify<Module>Credentials.ts
    listSomething.ts          ← authorize + prepare exports when declared

src/hooks/db2ai/<module>-tools/
    verify<Module>Credentials.ts
    ...
```

| DSL declaration             | Generated import        | Typical export                              |
| --------------------------- | ----------------------- | ------------------------------------------- |
| `auth` + protected (api2ai) | `verifyCredential`      | `verifyXCredentials`, `toModuleCredentials` |
| `authorize` on tool         | `authorizers[toolName]` | `authorizeToolName`                         |
| `prepare` on tool           | `preparers[toolName]`   | `prepareToolNameInput`                      |

Stub files are created on first generate; implement logic, then regenerate (imports are wired automatically).

---

## api2ai upstream `auth { }`

```text
auth {
    in: header
    name: "Authorization"
    prefix: "Bearer "
}
```

On protected tools, `invokeTool` sets `requestHeaders[name]` or `url.searchParams` from the resolved credential after `verifyCredential`.

**Query auth example** (demo `test.api2ai`):

```text
auth {
    in: query
    name: "api_key"
    prefix: ""
}
```

---

## db2ai `auth` keyword

```text
auth
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

---

## MCP host credential sources

| Host             | Credential source                                                                 |
| ---------------- | --------------------------------------------------------------------------------- |
| stdio            | `--auth-env VAR` (reads from process env)                                         |
| passthrough HTTP | Client header (e.g. `x-api-token`) forwarded as MCP credential                    |
| OAuth HTTP       | Bearer token after MCP OAuth login in Cursor / Open WebUI                         |
| public HTTP      | No MCP credential; upstream may still use API keys from env on the server process |

---

## Demo references

| Demo                      | Pattern                                          |
| ------------------------- | ------------------------------------------------ |
| `todo.api2ai`             | passthrough header + `verifyCredential`          |
| `test.api2ai`             | query `api_key` + protected route                |
| `banking.api2ai`          | `authorize` + `prepare` on financial reads       |
| `bookings.api2ai`         | OAuth MCP + role-based `authorize`               |
| `orders-postgresql.db2ai` | protected SQL + `prepare` injecting tenant scope |

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
