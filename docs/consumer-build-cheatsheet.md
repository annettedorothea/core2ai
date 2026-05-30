# Consumer build cheatsheet

Quick answers: **“I changed X — what do I run?”**

Layers: [1](./02-layer1-dsl-extension-core2ai.md) · [2](./03-layer2-mcp-server-and-tools.md) · [3](./04-layer3-cursor-and-agent.md)

---

## Daily commands (any consumer repo)

Run from **api2ai** or **db2ai** repository root unless noted.

| Goal                            | Command                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| Full build                      | `npm run langium:generate && npm run build && npm run check` |
| Regenerate all demo tools       | `npm run generate:all`                                       |
| Lint + typecheck generated only | `npm run check:generated`                                    |
| Smoke tests                     | `npm run test:smoke`                                         |
| MCP end-to-end tests            | `npm run test:e2e`                                           |
| Show current core2ai pin        | `npm run core2ai:pin`                                        |

api2ai only: `npm run install:demos` after pin refresh if demo `node_modules` is stale.

---

## I changed… → do this

### DSL file only (`.api2ai` / `.db2ai`)

| Step  | Action                                                               |
| ----- | -------------------------------------------------------------------- |
| 1     | Save file in extension **or** `npm run generate:all` in demos folder |
| 2     | `npm run check:generated` if CI/hooks matter                         |
| 3     | **Reload MCP** in Cursor if server tool list changed                 |
| Layer | 1 → 2 → 3                                                            |

No core2ai tag. No VSIX bump unless you ship a new extension.

---

### Generator (`packages/cli/src/generator/`)

| Step  | Action                            |
| ----- | --------------------------------- |
| 1     | `npm run build`                   |
| 2     | `npm run generate:all`            |
| 3     | `npm run check:generated`         |
| 4     | Commit regenerated `generated/**` |
| Layer | 1                                 |

Repeat in **both** api2ai and db2ai if you copied the same fix.

---

### Langium grammar (`packages/language/`)

| Step  | Action                           |
| ----- | -------------------------------- |
| 1     | `npm run langium:generate`       |
| 2     | `npm run build && npm run check` |
| Layer | 1                                |

---

### Extension UI (`packages/extension/src/`)

| Step  | Action                                      |
| ----- | ------------------------------------------- |
| 1     | `npm run build` (or F5 **Run … Extension**) |
| 2     | Test in Extension Development Host          |
| 3     | Bump extension version when releasing VSIX  |
| Layer | 1                                           |

---

### core2ai — `packages/mcp-host` or `packages/codegen`

| Step  | Where              | Action                             |
| ----- | ------------------ | ---------------------------------- |
| 1     | **core2ai**        | `npm run build && npm run check`   |
| 2     | **core2ai**        | Tag release (guided release CP2–3) |
| 3     | **api2ai + db2ai** | `npm run core2ai:use-pin`          |
| 4     | **both consumers** | `npm run bundle:mcp-runtime`       |
| 5     | **both consumers** | `npm run generate:all`             |
| 6     | **both consumers** | `npm run build && npm run check`   |
| 7     | **Cursor**         | Restart MCP servers                |
| Layer | 1 → 2              |

---

### core2ai — scripts / docs / skill only (no `packages/` change)

| Step  | Action                                |
| ----- | ------------------------------------- |
| 1     | Commit in core2ai                     |
| 2     | No pin refresh required for consumers |
| Layer | —                                     |

---

### Local core2ai development (sibling folder)

| Step  | Action                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------- |
| 1     | In consumer: `npm run core2ai:use-local`                                                                |
| 2     | After edits in core2ai: `npm run build` in core2ai, then consumer `bundle:mcp-runtime` + `generate:all` |
| 3     | Before push: `npm run core2ai:use-pin` in consumers                                                     |
| Layer | 1                                                                                                       |

---

### MCP host behaves wrong at runtime

| Check                         | Fix                                                  |
| ----------------------------- | ---------------------------------------------------- |
| Old `mcp-serve.mjs`           | `npm run bundle:mcp-runtime && npm run generate:all` |
| Wrong `@core2ai/core` version | `npm run core2ai:pin`, then refresh pin if needed    |
| Layer                         | 2                                                    |

---

### Agent does not call tools

| Check                | Fix                                      |
| -------------------- | ---------------------------------------- |
| Wrong workspace root | Open **demos** folder, not monorepo root |
| Server off           | Cursor Settings → Tools & MCP            |
| Missing `generated/` | `npm run generate:all`                   |
| Stale env            | Fix `.env.local`, **reload MCP**         |
| Layer                | 3                                        |

---

### Release VSIX (api2ai or db2ai)

| Step  | Action                                                                   |
| ----- | ------------------------------------------------------------------------ |
| 1     | Bump version (`npm run version:patch` or guided release CP5)             |
| 2     | `npm run extension:vsix -w packages/extension` — install & test manually |
| 3     | `npm run release:vsix` — publish **that** VSIX to GitHub (no rebuild)    |
| Layer | 1                                                                        |

Maintainers: [guided-release/SKILL.md](../.cursor/skills/guided-release/SKILL.md).

---

### Release `@core2ai/core` library only

| Step  | Action                                                                |
| ----- | --------------------------------------------------------------------- |
| 1     | Tag in core2ai                                                        |
| 2     | `core2ai:use-pin` + bundle + generate in both consumers               |
| 3     | VSIX optional — only if you also changed consumer extension/generator |
| Layer | 1                                                                     |

---

## Install troubleshooting

| Problem            | Try                                |
| ------------------ | ---------------------------------- |
| GitHub SSH errors  | `npm run install:github-https`     |
| Pin source unclear | `npm run core2ai:pin -- --verbose` |

---

## File locations cheat sheet

| What                | Typical path                                           |
| ------------------- | ------------------------------------------------------ |
| DSL demos           | `packages/extension/demos/*.api2ai` or `*.db2ai`       |
| Generated tools     | `packages/extension/demos/generated/tools/`            |
| MCP host            | `packages/extension/demos/generated/cli/mcp-serve.mjs` |
| MCP config          | `packages/extension/demos/.cursor/mcp.json`            |
| Bundled host source | `packages/cli/resources/mcp-serve-emitted.mjs`         |
| Pin canonical       | `core2ai/scripts/core2ai-pin.json`                     |

---

## Do not

| Avoid                                    | Do instead                                 |
| ---------------------------------------- | ------------------------------------------ |
| Hand-edit `generated/**`                 | Fix generator or DSL, regenerate           |
| Hand-edit `node_modules/@core2ai/core`   | Pin refresh                                |
| Commit `file:../core2ai` in package.json | `use-local` locally, `use-pin` for commits |
| Run `release:vsix` before testing VSIX   | Build + manual test first                  |

---

#Col3:23
