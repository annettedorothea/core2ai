# Supported OpenAPI patterns (api2ai)

[← Documentation index](../README.md)

api2ai targets **curated** MCP tools, not full automatic OpenAPI-to-MCP conversion. You list operations explicitly in `.api2ai`; the factory generates tooling only for those blocks.

## Contents

- [OpenAPI loading](#openapi-loading)
- [Works well](#works-well)
- [Fallback and degradation](#fallback-and-degradation)
- [Rejected or warned](#rejected-or-warned-in-the-editor)
- [When schemas are weak](#when-schemas-are-weak)

See also: [api2ai DSL](./api2ai-dsl.md).

---

## OpenAPI loading

Specs are loaded with `@apidevtools/swagger-parser` **`dereference()`** — internal and external `$ref` pointers are resolved before:

- LSP validation and completions
- Zod input schema emission
- `invokeTool` body serialization hints

OpenAPI **3.x** only (`openapi: 3.0.x` / `3.1.x`).

---

## Works well

| Area                | Support                                                        |
| ------------------- | -------------------------------------------------------------- |
| Operation selection | Explicit `METHOD "/path"` blocks in `.api2ai`                  |
| Primitives          | `string`, `integer`, `number`, `boolean`                       |
| Objects             | `properties`, `required`, nested objects                       |
| Arrays              | `items` with primitive or object element schemas               |
| `enum`, `nullable`  | Emitted into Zod                                               |
| `oneOf` / `anyOf`   | Zod unions when constitutent schemas resolve after dereference |
| Parameters          | `path`, `query`, `header` with form/simple serialization       |
| Request bodies      | JSON `application/json` schemas                                |
| Auth mapping        | `auth { in: header\|query, name, prefix }` on protected tools  |

---

## Fallback and degradation

| Situation                              | Generated behavior                                      |
| -------------------------------------- | ------------------------------------------------------- |
| Unresolved `$ref` or circular schema   | Generic JSON `object` in tool input; validator may warn |
| `allOf` composition                    | May emit `z.unknown()` when merge is not flattened      |
| Weak or missing parameter descriptions | Use DSL `params` overrides                              |
| Weak request body                      | Use DSL `body` and `intent` prose                       |

---

## Rejected or warned in the editor

| Pattern                               | Typical outcome                          |
| ------------------------------------- | ---------------------------------------- |
| Cookie parameters                     | Validation error (not supported)         |
| Object/array **header** parameters    | Error — MVP supports scalar headers only |
| Exotic query styles (non-form arrays) | Error or warning                         |
| `explode=true` on header params       | Warning                                  |
| OpenAPI 2.x / Swagger only            | Load error — 3.x required                |

---

## MCP argument shape

Tool JSON Schemas use **flat** top-level fields for path, query, and header parameters. Nested `pathParams` / `query` objects in MCP calls are **not** accepted — agents must pass `itemId`, `limit`, etc. at the top level.

---

## HTTP methods

`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `TRACE` are supported. `TRACE` uses a `node:http` fallback because Node `fetch` rejects that method.

---

## When schemas are weak

1. Add DSL overrides: `params`, `body`, `response`, `intent`, `example`.
2. Fix or simplify the OpenAPI spec where possible.
3. Run `generate:all` and `build:generated` after changes.
4. Re-test with `/test-all` or MCP Inspector before release.

---

## Reference harness

`api2ai` demo `test.api2ai` exercises dereferenced `$ref` bodies, `oneOf`/`anyOf`/`allOf`, all HTTP methods, query auth, and hooks — see the `test` stdio server in the demo `mcp.json`.

---

## See also

- [Documentation index](../README.md)
- [Auth and hooks](./auth-and-hooks.md)

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
