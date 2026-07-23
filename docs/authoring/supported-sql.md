# Supported SQL patterns (db2ai)

[← Documentation index](../README.md)

db2ai targets **curated** MCP tools from hand-written SQL — you declare each query in `.db2ai`; the factory does not introspect the whole database or expose tables automatically.

## Contents

- [Database dialects](#database-dialects)
- [Named placeholders](#named-placeholders-name)
- [EXPLAIN dry-run](#explain-dry-run-lsp-validation)
- [Connection URLs](#connection-url-details)
- [Dialect-specific tips](#dialect-specific-sql-authoring-tips)
- [Known limitations](#known-limitations)

See also: [db2ai DSL](./db2ai-dsl.md), [Auth and hooks](./auth-and-hooks.md).

---

## Database dialects

Declare the dialect on the first line of the file:

```text
database postgres env "PAGILA_POSTGRESQL_DATABASE_URL"
```

| DSL keyword | Engine               | Connection URL prefix                                               |
| ----------- | -------------------- | ------------------------------------------------------------------- |
| `postgres`  | PostgreSQL           | `postgresql://` or `postgres://`                                    |
| `mysql`     | MySQL                | `mysql://`                                                          |
| `mariadb`   | MariaDB              | `mariadb://` (rewritten to `mysql://` for `mysql2` at connect time) |
| `sqlserver` | Microsoft SQL Server | `sqlserver://` or `mssql://`                                        |
| `oracle`    | Oracle Database      | `oracle://user:pass@host:port/SERVICE`                              |
| `duckdb`    | DuckDB (in-memory)   | none — declare `database duckdb` **without** `env`                  |

For server dialects, the env var name must match a key in the workspace `.env` (value on the same line). The validator warns when the variable is missing or empty.

**DuckDB file sources (CSV, Excel, …):** load data in the write-once `initDatabase` stub under `src/db/db2ai/<module>-tools/` (views for tool SQL). Re-generate does not overwrite that stub. Demos: `flight.db2ai` (CSV), `sales-report.db2ai` (Excel).

---

## Works well

| Area              | Support                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Tool selection    | Explicit `SQL { … }` blocks per query                                                                             |
| Placeholders      | Named `:identifier` binds in `query` (see bind rules below)                                                       |
| Parameter schema  | `params: { name: { description, example, type } }` — types: `string`, `integer`, `number`, `boolean`              |
| Agent metadata    | `intent`, `summary`, `description`, `example`                                                                     |
| Access control    | `access: public \| protected`, optional `auth`, hooks                                                             |
| Editor validation | `EXPLAIN`-style dry-run when DB is reachable and examples are set                                                 |
| Demos             | Pagila/Sakila, `animals-sqlserver`, `plants-oracle`, orders OAuth, DuckDB `flight` (CSV) / `sales-report` (Excel) |

---

## Named placeholders (`:name`)

Authors always write **`:name`** in SQL. The generator rewrites binds per dialect at runtime:

| Dialect         | Author syntax                    | Runtime bind style                       |
| --------------- | -------------------------------- | ---------------------------------------- |
| PostgreSQL      | `:limit`, `:userId`              | `$1`, `$2`, … (unique names, positional) |
| MySQL / MariaDB | `:limit` (repeat `:x` if needed) | `?` per **occurrence** in the query      |
| SQL Server      | `:searchText`                    | `@searchText`                            |
| Oracle          | `:limit`                         | `:limit` (native named binds)            |
| DuckDB          | `:limit`, `:city`                | `$1`, `$2`, … (same rewrite as Postgres) |

**PostgreSQL casts:** `::type` is not treated as a placeholder (regex excludes `::`).

**Validator error:** if `query` contains `:name` but no `params: { … }` block.

**Validator error:** param keys must match placeholders; unused or missing keys are reported.

---

## EXPLAIN dry-run (LSP validation)

When the database is reachable, the language service validates each tool query without executing DML:

| Dialect         | Probe mechanism                                         |
| --------------- | ------------------------------------------------------- |
| PostgreSQL      | `EXPLAIN (VERBOSE) …` with `$n` binds — not `ANALYZE`   |
| MySQL / MariaDB | `EXPLAIN …` with `?` binds                              |
| SQL Server      | `SET NOEXEC ON; …; SET NOEXEC OFF;` with `@name` inputs |
| Oracle          | `EXPLAIN PLAN FOR …` with `:name` binds                 |
| DuckDB          | `EXPLAIN …` with `$n` binds (no `VERBOSE`)              |

**Oracle note:** `RETURNING` clauses are stripped before `EXPLAIN PLAN FOR` because the planner cannot parse DML `RETURNING` in that form.

**Skipped with warning (not error):**

- Database unreachable (Docker down, wrong host, firewall)
- Missing `example` on a param required for the probe

Unit tests mock connectivity; authors need a live database in the workspace for real `EXPLAIN` feedback.

---

## Connection URL details

### SQL Server

- URL form: `sqlserver://user:pass@host:1433/DatabaseName?encrypt=true&trustServerCertificate=true`
- ADO-style strings (`Server=…;Database=…;…`) are also accepted at runtime.

### Oracle

- URL must include a service name path: `oracle://user:pass@host:1521/FREEPDB1`
- Parsed into `user`, `password`, `connectString` for `node-oracledb`.

### MariaDB vs MySQL

- Declare `database mariadb` with a `mariadb://` URL.
- Validation and invoke use the same code path as MySQL (`mysql2` driver).

### DuckDB

- Declare `database duckdb` with **no** `env` (in-memory only).
- Register file-backed views in `initDatabase` (CSV via `read_csv_auto`, Excel via `INSTALL`/`LOAD excel` + `read_xlsx`, …).
- Tool SQL should query those views; keep messy spreadsheet cleanup in `initDatabase`, not in every tool query.

---

## MCP argument shape

SQL bind parameters are **flat** top-level MCP tool fields (`limit`, `offset`, `customerId`, …) matching `params` keys.

---

## Read vs. write SQL

The DSL does **not** restrict `SELECT` vs `INSERT` / `UPDATE` / `DELETE`. Authors choose read-only or DML deliberately and protect write tools with `access: protected` and hooks. Validation probes syntax/planning; it does not enforce a mutation policy in the grammar.

---

## Rejected or warned in the editor

| Pattern                                                      | Typical outcome                             |
| ------------------------------------------------------------ | ------------------------------------------- |
| `:placeholders` without `params` block                       | Error                                       |
| Duplicate or orphan param keys                               | Error                                       |
| `auth` set, all tools `public`                               | Warning                                     |
| Env var not set                                              | Warning                                     |
| DB unreachable during validation                             | Warning per query (`DB validation skipped`) |
| Missing param `example` when DB validation runs              | Warning                                     |
| Invalid `example` for `type: integer` / `number` / `boolean` | Error                                       |

---

## Dialect-specific SQL authoring tips

Write idiomatic SQL for the target engine — the factory does not translate dialects.

| Topic                   | PostgreSQL         | MySQL / MariaDB                 | SQL Server       | Oracle                    |
| ----------------------- | ------------------ | ------------------------------- | ---------------- | ------------------------- |
| Row limit               | `LIMIT n`          | `LIMIT n`                       | `SELECT TOP (n)` | `FETCH FIRST n ROWS ONLY` |
| String concat in `LIKE` | `\|\|`             | `CONCAT()` or `\|\|` (sql_mode) | `+`              | `\|\|`                    |
| Pagination              | `LIMIT` / `OFFSET` | same                            | `OFFSET … FETCH` | `OFFSET … FETCH`          |

See demo files: `pagila-postgresql.db2ai`, `sakila-mysql.db2ai`, `animals-sqlserver.db2ai`, `plants-oracle.db2ai`, `flight.db2ai`, `sales-report.db2ai`.

---

## When validation is weak or offline

1. Add complete `params` with `description`, `example`, and `type`.
2. Start the matching demo stack (`npm run start:all`).
3. Ensure `.env` URL matches the declared dialect prefix.
4. Regenerate after DSL changes (`generate:all`, `build:generated`).
5. Run `/test-all` (skill `db2ai-test-all-mcp`) before release.

---

## Known limitations

- No automatic schema discovery or query builder — SQL is author-supplied.
- No DSL-level read-only flag; use hooks and access control for writes.
- Live `EXPLAIN` is not run in CI (mocked in unit tests).
- Generated MCP hosts are **tool servers** only (`tools/list`, `tools/call`).
- Stored procedures, dynamic SQL, and multi-statement batches may fail validation depending on dialect probe support.

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
