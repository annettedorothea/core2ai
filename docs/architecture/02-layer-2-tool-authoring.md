# Layer 2: Tool Authoring

This layer is where concrete AI tools are defined using DSLs.

Tool authors translate APIs and databases into structured, AI-consumable tools.

---

## DSLs

### API-based tools

`.api2ai` is based on OpenAPI definitions.

It allows selection and enrichment of API operations with AI-facing metadata such as:

- intent description
- tool name
- usage examples
- optional authentication configuration

---

### Database-based tools

`.db2ai` is based on SQL.

Developers write SQL queries that are:

- validated against a real database using `EXPLAIN` (dry-run, no data changes)
- supported for PostgreSQL and MySQL
- enriched with AI-facing metadata (intent, examples, tool names, optional column documentation)
- optional authentication configuration

---

## Access Control (Important Concept)

Tool Authoring also supports programmable access control.

Access rules are **not defined in the DSL**, because they are not expressive enough for real-world authorization logic.

Instead, authorization is implemented in code.

### Runtime behavior:

- Each request arrives with an authentication token
- The token is evaluated programmatically before execution
- The tool call is either:
    - allowed
    - denied
    - or modified with injected parameters

### Example patterns:

- userId is extracted from token and injected into tool parameters
- data access is restricted to user-scoped resources (e.g. "only my orders")
- requests can be fully rejected based on custom logic

---

## Code Generation Output

The DSL is compiled into:

- MCP tool modules
- stdio MCP host integration
- executable tool definitions

---

## Key Idea

Tool Authoring turns structured API/DB definitions into AI-ready tools, while keeping security and access logic fully programmable.

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
