# Documentation hub

Welcome. This is the shared architecture guide for **core2ai**, **api2ai**, and **db2ai**.

Think of the stack as three stages in one **tool factory** — see the [overview illustration](./01-three-layers-overview.md#tool-factory-analogy):

| Stage       | Analogy      | You work with…                                           | You get…                                    |
| ----------- | ------------ | -------------------------------------------------------- | ------------------------------------------- |
| **Layer 1** | Tool factory | DSL files, the VS Code extension, shared core2ai library | A **VSIX** you install in Cursor            |
| **Layer 2** | Tool builder | Generated files in your project folder                   | An **MCP server** + **tool modules**        |
| **Layer 3** | Carpenter    | Cursor settings and chat                                 | The **agent** calling your APIs or database |

---

## Start here

| Doc                                                                               | What it explains                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------- |
| [**01 — Three layers overview**](./01-three-layers-overview.md)                   | Big picture, tool-factory analogy, repos          |
| [**02 — Layer 1: DSL, extension, core2ai**](./02-layer1-dsl-extension-core2ai.md) | Language, generator, VSIX, and the core2ai pin    |
| [**03 — Layer 2: MCP server and tools**](./03-layer2-mcp-server-and-tools.md)     | What `generate` produces and how a tool call runs |
| [**04 — Layer 3: Cursor and the agent**](./04-layer3-cursor-and-agent.md)         | `mcp.json`, enabling servers, testing in chat     |

---

## Quick reference

| Doc                                                             | When to open it                |
| --------------------------------------------------------------- | ------------------------------ |
| [**Consumer build cheatsheet**](./consumer-build-cheatsheet.md) | “I changed X — what do I run?” |

---

## Repositories

| Repo                                                      | Role                                                |
| --------------------------------------------------------- | --------------------------------------------------- |
| [**core2ai**](https://github.com/annettedorothea/core2ai) | Shared MCP host + codegen helpers (`@core2ai/core`) |
| [**api2ai**](https://github.com/annettedorothea/api2ai)   | OpenAPI → `.api2ai` DSL → MCP tools                 |
| [**db2ai**](https://github.com/annettedorothea/db2ai)     | SQL → `.db2ai` DSL → MCP tools                      |

Each consumer repo has its own README and demo workspace under `packages/extension/demos/`.

Illustrations: compressed PNGs live next to these docs (`Tool-factory*.png`). Full-resolution masters stay local in `large-images/` (gitignored).

**Markdown preview:** open a doc from `docs/` (same folder as the PNG files), then **Markdown: Open Preview** (`⇧⌘V`). If images stay blank, reload the window once after the workspace setting `markdown.preview.securityLevel` → `allowInsecureLocalContent` (set in `mcp-dsl.code-workspace` and `core2ai/.vscode/settings.json`).

---

## Release (maintainers)

For a step-by-step release with checkpoints, use the **guided release** skill:

[`.cursor/skills/guided-release/SKILL.md`](../.cursor/skills/guided-release/SKILL.md)

Human-readable workflow markdown files may follow later; the skill is the live source of truth today.

---

#Col3:23
