# core2ai

Shared package for **api2ai** and **db2ai**.

| Package             | Purpose                                                         |
| ------------------- | --------------------------------------------------------------- |
| `@core2ai/codegen`  | Generate validation, auth-stub bootstrap, MCP project bootstrap |
| `@core2ai/mcp-host` | Generic MCP stdio host + `mcp-standalone-entry` for esbuild     |

The repository root is installable as `@core2ai/core`. **Consumers pin an explicit Git tag** (not `main`):

```json
{
    "dependencies": {
        "@core2ai/core": "github:annettedorothea/core2ai#v0.0.5"
    }
}
```

After publishing a new tag here:

1. Edit **`scripts/core2ai-pin.json`** (tag + `spec`).
2. In **api2ai** / **db2ai**: **`npm run core2ai:use-pin`** (sync manifests, force reinstall, refresh lockfile).
    - Pin source: sibling **`../core2ai/scripts`** when present, else installed `@core2ai/core`, else `CORE2AI_PIN_SOURCE`.
3. api2ai only: `npm run install:demos` if demos still resolve an old commit.
4. Both consumers: `npm run bundle:mcp-runtime`, `npm run generate:all`, `npm run build`, `npm run check`.

Local development against sibling core2ai: **`npm run core2ai:use-local`** in the consumer (commits OK; **push** requires **`core2ai:use-pin`**).

Show pin: `npm run core2ai:pin`. If GitHub SSH fails: **`install:github-https`**.

Subpath imports:

```ts
import { assertDocumentValidForGenerate } from '@core2ai/core/codegen';
import { readGeneratedModule } from '@core2ai/core/mcp-host';
```

## Docs

Architecture hub (three layers, core2ai ↔ siblings, build cheatsheet):

| Doc                                                                                | Topic                 |
| ---------------------------------------------------------------------------------- | --------------------- |
| [**docs/README.md**](./docs/README.md)                                             | Hub — start here      |
| [01 — Three layers overview](./docs/01-three-layers-overview.md)                   | Big picture           |
| [02 — Layer 1: DSL, extension, core2ai](./docs/02-layer1-dsl-extension-core2ai.md) | VSIX, pin, Langium    |
| [03 — Layer 2: MCP server and tools](./docs/03-layer2-mcp-server-and-tools.md)     | Generated runtime     |
| [04 — Layer 3: Cursor and the agent](./docs/04-layer3-cursor-and-agent.md)         | `mcp.json`, testing   |
| [Consumer build cheatsheet](./docs/consumer-build-cheatsheet.md)                   | “I changed X → run Y” |

Release (maintainers): [guided-release skill](./.cursor/skills/guided-release/SKILL.md)

## Build

```bash
npm install
npm run build
npm run check
```

Rebuild core2ai before rebuilding a consumer after host or codegen changes.

## Git hooks

`postinstall` does not install hooks (safe for GitHub dependency installs). For local work in this repo:

```bash
npm run install:hooks
```

---

#Col3:23
