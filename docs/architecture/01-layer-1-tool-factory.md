# Layer 1: Tool Factory (Build-Time Infrastructure)

[← Documentation index](../README.md)

The Tool Factory is the foundation of the system. It provides everything needed to define, validate, and generate AI tools from structured specifications.

## Contents

- [Responsibilities](#responsibilities)
- [Output Artifacts](#output-artifacts)
- [Key Idea](#key-idea)

---

## Responsibilities

This layer defines the tool creation system, not the tools themselves.

It includes:

### DSL Definition Layer

- `.api2ai` (OpenAPI-based DSL)
- `.db2ai` (SQL-based DSL)
- Langium grammar definitions

### Language Features

- syntax validation
- schema-aware autocompletion
- AST transformation

### Code Generation Layer

- MCP tool module generation
- stdio MCP host generation
- shared runtime integration

### Tooling

- CLI generator for CI/CD usage
- VSIX extension for IDE integration

---

## Output Artifacts

The Tool Factory produces:

- VSIX extension (primary distribution unit)
- CLI generator
- shared core libraries for runtime execution

---

## Key Idea

This layer enables Tool Authoring, but does not define any business logic or domain tools itself.

---

## See also

- [Layer 2 – Tool Authoring](02-layer-2-tool-authoring.md)
- [Documentation index](../README.md)

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
