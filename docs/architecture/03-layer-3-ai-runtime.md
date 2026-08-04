# Layer 3: AI Runtime (Execution Layer)

[← Documentation index](../README.md)

This is the runtime layer where AI agents use generated tools.

## Contents

- [Execution Flow](#execution-flow)
- [Characteristics](#characteristics)
- [Key Idea](#key-idea)

At this level, there is no awareness of DSLs, schemas, or generation logic.

---

## Execution Flow

1. User submits a request
2. AI agent interprets intent
3. Relevant tool is selected
4. Tool is executed via MCP protocol
5. Result is returned to the agent
6. Response is synthesized for the user

---

## Characteristics

- fully abstracted from tool creation
- no dependency on DSL or code generator
- tools appear as native capabilities to the agent

---

## Key Idea

The AI agent does not “know” tools are generated.

It only sees capabilities it can execute.

---

## See also

- [MCP hosts](../runtime/mcp-hosts.md)
- [Cursor integration](../integrations/cursor.md)
- [VS Code / GitHub Copilot](../integrations/vscode.md)
- [Layer 2 – Tool Authoring](02-layer-2-tool-authoring.md)
- [Documentation index](../README.md)

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
