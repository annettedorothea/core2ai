# Layer 2: Tool Authoring

[← Documentation index](../README.md)

This layer is where concrete AI tools are defined using DSLs.

Tool authors translate APIs and databases into structured, AI-consumable tools.

## Contents

- [DSLs](#dsls)
- [Access Control](#access-control-important-concept)
- [Code Generation Output](#code-generation-output)
- [Key Idea](#key-idea)

---

## DSLs

### API-based tools

`.api2ai` is based on OpenAPI definitions.

It allows selection and enrichment of API operations with AI-facing metadata such as:

- intent description
- tool name
- usage examples
- optional authentication configuration

Authoring reference: [api2ai DSL](../authoring/api2ai-dsl.md) · [Supported OpenAPI patterns](../authoring/supported-openapi.md)

---

### Database-based tools

`.db2ai` is based on SQL.

Developers write SQL queries that are:

- validated against a real database using `EXPLAIN` (dry-run where supported)
- supported dialects: PostgreSQL, MySQL, MariaDB, SQL Server, Oracle
- enriched with AI-facing metadata (intent, examples, tool names, optional column documentation)
- optional authentication configuration

Authoring reference: [db2ai DSL](../authoring/db2ai-dsl.md) · [Supported SQL patterns](../authoring/supported-sql.md)

---

## Access Control (Important Concept)

Tool Authoring also supports programmable access control.

Access rules are **not defined in the DSL**, because they are not expressive enough for real-world authorization logic.

Instead, authorization is implemented in code.

### Runtime behavior

- Each request arrives with an authentication token
- The token is evaluated programmatically before execution
- The tool call is either allowed, denied, or modified with injected parameters

### Example patterns

- userId is extracted from token and injected into tool parameters
- data access is restricted to user-scoped resources (e.g. "only my orders")
- requests can be fully rejected based on custom logic

The DSL does not restrict read vs. write SQL. Tool authors choose SELECT-only or DML deliberately and secure write tools with `access: protected` and hooks — the factory does not enforce a mutation policy in the grammar.

See [Auth and hooks](../authoring/auth-and-hooks.md) for the runtime pipeline (`verifyCredential`, `checkToolAccess`, `prepareToolCall`).

---

## Code Generation Output

The DSL is compiled into:

- MCP tool modules
- stdio and HTTP MCP host binaries
- executable tool definitions with Zod input schemas

See [MCP hosts](../runtime/mcp-hosts.md) for runtime host variants.

---

## Key Idea

Tool Authoring turns structured API/DB definitions into AI-ready tools, while keeping security and access logic fully programmable.

---

## See also

- [Layer 1 – Tool Factory](01-layer-1-tool-factory.md)
- [Layer 3 – AI Runtime](03-layer-3-ai-runtime.md)
- [Personas](04-personas.md)
- [Documentation index](../README.md)

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
