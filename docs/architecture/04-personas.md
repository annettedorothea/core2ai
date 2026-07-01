# Personas

The system is structured around three human personas aligned with the three-layer architecture.

The personas correspond to the people interacting with the platform.

---

# The Factory Metaphor

The architecture can be understood using a simple factory metaphor.

- The **VSIX extensions** (`api2ai` and `db2ai`) are the **Tool Factories**.
- The factories contain the machines, workflows, and production lines required to create tools.
- The generated **MCP tools** are the actual **tools** produced by the factory.
- The **AI Agent** acts as a carpenter and uses those tools to solve problems.
- The **End User** requests outcomes and receives results.

In simple terms:

```text
Platform Maintainer
        ↓
Builds the Tool Factory

Tool Author
        ↓
Produces Tools

End User
        ↓
Receives Results from an AI Agent using those tools
```

---

## Layer 1: Platform / Tool Factory Maintainer

### Factory Metaphor

Builds the tool factory and the machines inside it.

The maintainer does not create individual tools.

Instead, they build and evolve the factories themselves:

- api2ai VSIX
- db2ai VSIX

These factories enable others to produce MCP tools.

### Responsibilities

- design and evolution of `.api2ai` and `.db2ai` DSLs
- Langium grammar and validation logic
- code generation architecture
- MCP runtime core design
- VSIX and CLI tooling
- build and release pipelines
- platform architecture decisions

### Required Skills

- expert knowledge of DSL design
- Langium development
- parser and compiler concepts
- code generation architectures
- TypeScript
- VS Code extension development (VSIX)
- bundling and build systems
- software architecture and system design
- MCP architecture and runtime concepts
- OpenAPI specifications
- relational database concepts
- schema design
- developer tooling and automation
- debugging and troubleshooting

### Experience Level

Platform engineering expertise.

### Goal

Build and maintain the infrastructure that enables tool creation.

---

## Layer 2: Tool Author / Engineer

### Factory Metaphor

Operates the factory and manufactures tools.

Tool Authors use the factories provided by Layer 1 to create concrete MCP tools.

The generated tools are analogous to physical tools produced in a workshop:

- saws
- hammers
- chisels
- screwdrivers

In the system, these become:

- database tools
- API tools

### Responsibilities

- writing `.api2ai` definitions based on OpenAPI
- writing `.db2ai` definitions based on database schemas
- mapping APIs and databases into AI tools
- defining intent, naming, and examples
- implementing custom authorization logic
- testing generated tools

### Access Control Note

Authorization is not defined in DSLs.

Instead, Tool Authors implement custom logic in code:

- request comes with authentication token
- token is evaluated at runtime
- tool execution may:
    - be allowed
    - be denied
    - have parameters modified (for example injecting a userId)

### Required Skills

- understanding of the business domain
- understanding of the target APIs and/or databases
- OpenAPI fundamentals
- SQL fundamentals
- database concepts
- data modeling concepts
- API design understanding
- AI tool design
- writing `.api2ai` and `.db2ai` definitions
- basic TypeScript development
- implementing custom access control logic
- testing and validation

### Experience Level

Domain expert or application engineer.

### Goal

Create high-quality, safe, and AI-usable tools.

---

## Layer 3: End User / Customer

### Factory Metaphor

The customer ordering furniture from a carpenter.

The customer interacts with an AI Agent that acts as the carpenter.

The carpenter uses tools produced by the factory to create the desired outcome.

The customer does not care how the tools were manufactured and does not need to understand:

- Langium
- DSLs
- MCP
- OpenAPI
- SQL
- VSIX extensions
- code generators

The customer only cares about the outcome.

### Responsibilities

- formulate requests
- evaluate results
- provide business context

### Required Skills

No technical skills required.

A rough understanding that:

- the AI can use tools
- tools may access APIs and databases
- some answers require tool execution

may be helpful, but is not required.

### Runtime Behavior

The AI Agent acts as the carpenter.

It:

- interprets requests
- selects appropriate tools
- executes tools via MCP
- combines results
- generates responses

The AI Agent uses the tools produced by Layer 2 but remains unaware of how the factory itself is implemented.

### Experience Level

Any user of the system.

### Goal

Solve business problems and obtain useful results.

---

#Col3:23
