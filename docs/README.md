# core2ai documentation

Hub for shared **api2ai** / **db2ai** workflows and architecture notes.

## Daily commands (consumer repos)

From **api2ai** or **db2ai** root after clone:

```bash
npm run install:github-https    # api2ai: also install:demos
npm run langium:generate && npm run build && npm run check
npm run generate:all            # in packages/extension/demos when DSL changed
```

Pin / local **core2ai** during development:

```bash
npm run core2ai:pin             # show current GitHub tag
npm run core2ai:use-local       # sibling ../core2ai for active core2ai work
npm run core2ai:use-pin         # GitHub pin before push
```

Smoke tests (see `scripts/dev-smoke.config.json` for scenarios):

```bash
npm run test:smoke              # all direct tool smokes
npm run test:e2e                # MCP stdio e2e suite
```

## Workflows (coming)

Checklists for release, VSIX, DSL changes, and fresh-clone setup will live under `workflows/` (see active plan in [`.cursor/plans/docs_und_aufraeumen_deckel.plan.md`](../.cursor/plans/docs_und_aufraeumen_deckel.plan.md)).

## Release

Use the **core2ai release** agent skill: [`.cursor/skills/core2ai-release/SKILL.md`](../.cursor/skills/core2ai-release/SKILL.md).

## Architecture

Three layers:

1. **core2ai** — shared MCP host + codegen bootstrap (`@core2ai/core`)
2. **api2ai / db2ai** — Langium DSL, CLI, VS Code extension
3. **Generated demos** — `packages/extension/demos/generated/` (committed pipeline output)

Consumers pin `@core2ai/core` via Git tag (`github:annettedorothea/core2ai#vX.Y.Z`), not `file:` on pushed branches.

---

#Col3:23
