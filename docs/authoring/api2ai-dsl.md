# api2ai DSL reference

[← Documentation index](../README.md)

The `.api2ai` file selects OpenAPI 3.x operations and enriches them for AI agents. **You curate** which endpoints become MCP tools — nothing is exposed automatically from the spec.

## Contents

- [File structure](#file-structure)
- [Operation block keywords](#operation-block-keywords)
- [MCP tool arguments](#mcp-tool-arguments-flat-shape)
- [Auth block](#auth-block-upstream-api)
- [Hooks block](#hooks-block)
- [DSL overrides](#dsl-overrides-when-openapi-is-weak)
- [Code generation output](#code-generation-output)
- [Learning examples](#learning-examples)

See also: [Supported OpenAPI patterns](./supported-openapi.md), [Auth and hooks](./auth-and-hooks.md), [db2ai DSL](./db2ai-dsl.md), [MCP hosts](../runtime/mcp-hosts.md).

---

## File structure

```text
openapi "./openapi/my-api.openapi.yaml"

auth {
    in: header
    name: "Authorization"
    prefix: "Bearer "
}

GET "/items/{itemId}" {
    toolName: getItem
    access: public
    intent: "Fetch one item by id"
    summary: "Get item"
    example: "Get item 42"
}
```

1. **OpenAPI reference** — relative path from the `.api2ai` file; loaded with `SwaggerParser.dereference()` so `$ref` in the spec resolve before validation and codegen.
2. **Optional `auth` block** — maps the MCP host credential to an upstream API header or query parameter (see [Auth and hooks](./auth-and-hooks.md)).
3. **Operation blocks** — one block per exposed tool: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, or `TRACE` plus OpenAPI path template.

---

## Operation block keywords

| Keyword       | Required | Purpose                                                    |
| ------------- | -------- | ---------------------------------------------------------- |
| `toolName`    | yes      | Stable MCP tool identifier (camelCase)                     |
| `access`      | yes      | `public` or `protected`                                    |
| `intent`      | yes      | Primary agent-facing description of what the tool does     |
| `summary`     | no       | Short title; falls back to OpenAPI `summary`               |
| `description` | no       | Longer prose; multiline `''' … '''` allowed                |
| `example`     | no       | Example user utterance or call pattern                     |
| `params`      | no       | Per-parameter overrides (`description`, `example`, `type`) |
| `body`        | no       | Prose or hints when request body schema is weak            |
| `response`    | no       | Prose describing success response for agents               |
| `hooks`       | no       | Per-tool `checkToolAccess` and/or `prepareToolCall`        |

Protected tools require a credential from the MCP host (stdio `--auth-env`, HTTP header, or OAuth Bearer). Hooks are implemented in `src/hooks/api2ai/<module>-tools/`.

---

## MCP tool arguments (flat shape)

Generated MCP JSON Schemas expose **top-level** fields for path, query, and header parameters — for example `itemId`, `limit`, `X-Trace-Id`.

Agents must **not** nest parameters under `pathParams` or `query` objects; those shapes are rejected by the tool schema.

Request bodies are a single `body` object when the operation has a JSON body schema.

---

## Auth block (upstream API)

```text
auth {
    in: header    // or query
    name: "Authorization"
    prefix: "Bearer "
}
```

- **`in`:** `header` or `query` — where the upstream API expects the secret.
- **`name`:** Header or query parameter name on the HTTP request to the API.
- **`prefix`:** Optional string prepended to the credential (e.g. `Bearer `).

This is **not** MCP login. It configures how the generated `invokeTool` attaches the verified credential to the upstream HTTP call.

Optional module verify stub:

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

**Validator warning:** if `auth { }` is present but every operation uses `access: public`, the editor shows a warning that auth has no effect.

---

## Hooks block

Declare per-operation hooks under `hooks: { … }`:

```text
GET "/bookings/{customerId}" {
    toolName: listBookings
    access: protected
    hooks: {
        checkToolAccess: true
        prepareToolCall: true
    }
    intent: "List bookings for one customer"
}
```

| Hook flag         | Purpose                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `checkToolAccess` | Allow or deny before HTTP (`checkToolAccessForToolName(credential)`)                               |
| `prepareToolCall` | Reshape invoke options before HTTP (`prepareToolCallForToolName(…)`)                               |
| `afterToolCall`   | Transform successful result before MCP (`afterToolCallForToolName(result, options[, credential])`) |

Enable only what you need:

```text
hooks: {
    prepareToolCall: true
}
```

Optional MCP parameters (filled in the hook, often from the credential):

```text
hooks: {
    prepareToolCall: {
        clientMayOmit: [customerId]
    }
}
```

### hookParams (MCP-only)

Declare optional fields that appear flat in the MCP schema but are **never** sent on HTTP. After normalize they live under `options.hookParams` for `prepareToolCall` / `afterToolCall`.

```text
hookParams: {
    titleContains: {
        type: string
        description: "Client-side title filter (not an API query param)."
        example: "milk"
    }
}
```

Each entry needs `type` (`string` | `integer` | `number` | `boolean` | `array`). All hookParams are optional. See [Auth and hooks](./auth-and-hooks.md).

Implement stubs in `src/hooks/api2ai/<module>-tools/<toolName>.ts`. See [Auth and hooks](./auth-and-hooks.md).

---

## DSL overrides when OpenAPI is weak

Use when dereferenced schemas are generic or agent guidance is insufficient:

```text
GET "/items" {
    toolName: listItems
    access: public
    intent: "List items filtered by tag"
    params: {
        tag: {
            description: "Required category tag"
            example: "electronics"
        }
        status: {
            description: "Optional open or done"
            example: "open"
        }
    }
    body: '''
        JSON body: name (required string), note (optional string).
    '''
    response: '''
        HTTP 200 — array of items with id and name.
    '''
}
```

Regenerate after changing OpenAPI or `.api2ai` (`generate:all`, `build:generated`).

---

## Code generation output

Saving the file (or running the CLI) emits:

```text
generated/api2ai/tools/<module>-tools.ts
generated/api2ai/cli/stdio-runtime.ts
generated/api2ai/cli/public-http-runtime.ts
generated/api2ai/cli/passthrough-http-runtime.ts
generated/api2ai/cli/oauth-http-runtime.ts
generated/api2ai/servers/<module>-stdio-mcp-server.ts
generated/api2ai/servers/<module>-public-http-mcp-server.ts
generated/api2ai/servers/<module>-passthrough-http-mcp-server.ts
generated/api2ai/servers/<module>-oauth-http-mcp-server.ts
```

Each tool module exports `invokeTool`, Zod schemas, and optional hook imports.

---

## HTTP methods and TRACE

All listed HTTP verbs are supported in the DSL. Node `fetch` does not support `TRACE`; generated code uses `node:http` / `node:https` for TRACE requests automatically.

---

## Learning examples

| Demo                | Focus                                               |
| ------------------- | --------------------------------------------------- |
| `open-meteo.api2ai` | Public tools, no auth                               |
| `todo.api2ai`       | `auth` + `verifyCredential`                         |
| `bookings.api2ai`   | OAuth MCP + `checkToolAccess` + `prepareToolCall`   |
| `test.api2ai`       | Coverage harness (all methods, `$ref`, combinators) |

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
