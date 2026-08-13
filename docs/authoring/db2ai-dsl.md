# db2ai DSL reference

[← Documentation index](../README.md)

The `.db2ai` file declares database connections and SQL tools for AI agents. **You curate** which queries become MCP tools — not every table or statement is exposed automatically.

## Contents

- [File structure](#file-structure)
- [Database declaration](#database-declaration)
- [SQL block keywords](#sql-block-keywords)
- [SQL validation](#sql-validation-explain)
- [Named placeholders and MCP args](#mcp-tool-arguments-flat-shape)
- [Hooks](#hooks)
- [Learning examples](#learning-examples)

See also: [Supported SQL patterns](./supported-sql.md), [Auth and hooks](./auth-and-hooks.md), [api2ai DSL](./api2ai-dsl.md), [Layer 2 – Tool Authoring](../architecture/02-layer-2-tool-authoring.md).

---

## File structure

```text
database postgres env "PAGILA_POSTGRESQL_DATABASE_URL"

auth

SQL {
    toolName: listFilms
    access: protected
    hooks: {
        prepareToolCall: true
    }
    intent: "List films with pagination"
    query: "SELECT * FROM film LIMIT LEAST(:limit, 100) OFFSET :offset"
    params: {
        limit: { description: "max rows per page" example: "100" type: integer }
        offset: { description: "rows to skip" example: "0" type: integer }
    }
}
```

1. **`database` line** — dialect + env var for the connection URL (omit `env` for DuckDB).
2. **Optional `auth` keyword** — enables the credential pipeline for protected tools (see [Auth and hooks](./auth-and-hooks.md)).
3. **`SQL { }` blocks** — one tool per block.

---

## Database declaration

```text
database postgres env "PAGILA_POSTGRESQL_DATABASE_URL"
```

| Dialect keyword | Engine               |
| --------------- | -------------------- |
| `postgres`      | PostgreSQL           |
| `mysql`         | MySQL                |
| `mariadb`       | MariaDB              |
| `sqlserver`     | Microsoft SQL Server |
| `oracle`        | Oracle               |
| `duckdb`        | DuckDB (in-memory)   |

Server dialects require an env var in the workspace `.env` (value on the same line as the key). The validator emits a **warning** when the variable is missing or empty at editor time.

**DuckDB:** declare `database duckdb` **without** `env`. Load CSV/Excel (or other files) in the write-once `initDatabase` stub; see [Supported SQL patterns](./supported-sql.md).

---

## SQL block keywords

| Keyword       | Required                       | Purpose                                                                                        |
| ------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `toolName`    | yes                            | Stable MCP tool identifier                                                                     |
| `access`      | yes                            | `public` or `protected`                                                                        |
| `intent`      | yes                            | Agent-facing description                                                                       |
| `query`       | yes                            | SQL with `:name` bind placeholders                                                             |
| `params`      | when query has `:placeholders` | Per-parameter schema for MCP (`description`, `example`, `type`)                                |
| `summary`     | no                             | Short title                                                                                    |
| `description` | no                             | Longer prose                                                                                   |
| `example`     | no                             | Example user question                                                                          |
| `annotations` | no                             | Optional MCP tool hints (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) |
| `hooks`       | no                             | Per-tool `checkToolAccess` and/or `prepareToolCall`                                            |

**Validator error:** if `query` contains `:name` placeholders but no `params: { … }` block, validation fails.

**Validator warning:** if `auth` is set but every SQL block uses `access: public`, auth has no effect.

`annotations` are **curated** MCP ToolAnnotations — never inferred from the SQL text. Local DB tools typically use `openWorldHint: false`. When omitted, clients keep pessimistic defaults.

```text
SQL {
    toolName: listFilms
    access: protected
    intent: "list films with pagination"
    query: "SELECT * FROM film LIMIT LEAST(:limit, 100) OFFSET :offset"
    summary: "Paginated film rows"
    annotations: {
        readOnlyHint: true
        openWorldHint: false
    }
    params: {
        limit: { description: "max rows" example: "100" type: integer }
        offset: { description: "rows to skip" example: "0" type: integer }
    }
}
```

---

## SQL validation (EXPLAIN)

Before codegen, the language service runs `EXPLAIN` (or dialect equivalent) against the configured database. This is a **dry-run** — it validates syntax and plan feasibility without applying DML.

Unit tests mock the driver; authors need a reachable database in the workspace for live validation.

---

## Read vs. write SQL

The DSL does **not** restrict SELECT vs. INSERT/UPDATE/DELETE. Tool authors choose read-only or DML deliberately and secure write tools with `access: protected` and hooks. The grammar does not enforce a mutation policy.

---

## MCP tool arguments (flat shape)

SQL bind parameters appear as **top-level** MCP tool fields matching `params` keys (e.g. `limit`, `offset`, `customerId`).

---

## Auth keyword

Bare keyword (typical):

```text
auth
```

Or with explicit verify stub:

```text
auth {
    hooks: {
        verifyCredential: true
    }
}
```

Database credentials stay in environment variables; `auth` enables MCP credential checks and hooks. Protected tools require a credential from the MCP host. Codegen emits a `verify<Module>Credential.ts` stub when `auth` is present.

---

## Hooks

Per SQL block:

```text
hooks: {
    checkToolAccess: true
    prepareToolCall: {
        clientMayOmit: [customerId]
    }
}
```

| Hook flag         | Purpose                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `checkToolAccess` | Allow or deny before SQL (`checkToolAccessForToolName(credential)`)    |
| `prepareToolCall` | Inject or reshape bind params (`prepareToolCallForToolName(…)`)        |
| `afterToolCall`   | Transform successful result before MCP (`afterToolCallForToolName(…)`) |

`clientMayOmit` marks bind params optional in the MCP schema; `prepareToolCall` fills defaults (for example `customerId` from JWT).

Implement in `src/hooks/db2ai/<module>-tools/`. See [Auth and hooks](./auth-and-hooks.md) for the full pipeline.

---

## Code generation output

Same layout as api2ai under `generated/db2ai/tools/` and `generated/db2ai/cli/`.

---

## Learning examples

| Demo                      | Focus                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `pagila-postgresql.db2ai` | PostgreSQL, public `prepareToolCall` (limit cap)                                             |
| `sakila-mysql.db2ai`      | MySQL + passthrough MCP auth                                                                 |
| `orders-postgresql.db2ai` | OAuth MCP, `checkToolAccess`, `clientMayOmit`                                                |
| `flight.db2ai`            | DuckDB in-memory + CSV via `initDatabase`                                                    |
| `sales-report.db2ai`      | DuckDB in-memory + multi-sheet Excel; `topCustomersByRevenue` + `afterToolCall` (CSV → temp) |

---

## See also

- [Documentation index](../README.md)
- [MCP hosts](../runtime/mcp-hosts.md)

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
