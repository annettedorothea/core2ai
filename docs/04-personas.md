# Personas

The system is structured around three distinct roles, aligned with the three-layer architecture.

---

## Layer 1: Platform / Tool Factory Maintainer

Responsible for building and maintaining the Tool Factory.

### Responsibilities

- design and evolution of `.api2ai` and `.db2ai` DSLs
- Langium grammar and validation logic
- code generation architecture
- MCP runtime core design
- VSIX and CLI tooling

### Goal

Build and maintain the infrastructure that enables tool creation.

---

## Layer 2: Tool Author / Engineer

Responsible for defining concrete tools using DSLs.

### Responsibilities

- writing `.api2ai` definitions based on OpenAPI
- writing `.db2ai` SQL-based tool definitions
- mapping APIs and databases into AI tools
- defining intent, naming, and examples
- working within schema constraints

### Access Control Note

Authorization is not defined in DSLs.

Instead, Tool Authors implement custom logic in code:

- request comes with authentication token
- token is evaluated at runtime
- tool execution may:
    - be allowed
    - be denied
    - or have parameters modified (e.g. injecting userId for scoped queries)

### Goal

Create high-quality, safe, and AI-usable tools.

---

## Layer 3: AI Agent / Tool Consumer

Responsible for using tools at runtime.

### Responsibilities

- interpret user requests
- select appropriate tools
- execute tools via MCP
- generate final responses

### Goal

Solve user problems using available tools without awareness of underlying implementation.

---

#Col3:23
