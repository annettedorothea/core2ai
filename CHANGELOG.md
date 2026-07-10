# Changelog

All notable changes to **@toolfactory.dev/core** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com). Versioning follows [Semantic Versioning](https://semver.org).

Policy: [docs/development/changelog-policy.md](docs/development/changelog-policy.md)

---

## [Unreleased]

---

## [1.0.0-rc.7] - 2026-07-10

### Added

- **Demo scripts:** `optionalEnvInt` in generated `require-env.mjs` — kill scripts skip missing port env vars instead of aborting

### Upgrade notes

- Run `generate:all` or `sync:generated-scripts` in api2ai/db2ai demos after pin refresh

---

## [1.0.0-rc.6] - 2026-07-09

### Fixed

- **Build stamp:** `mcp-build-generated-at.ts` uses single-quoted strings (Prettier `singleQuote`) instead of `JSON.stringify` double quotes — fixes consumer `format:check` / `vsix:prepare` after `generate:all`

---

## [1.0.0-rc.5] - 2026-07-09

### Changed

- **MCP codegen:** monolith renderers replaced with `compose` + `templates/` + `snippets/`; auth pipeline fragments stay in consumers
- **Build stamp:** central `mcp-build-generated-at.ts` writer; `serverInfo.version` / tool description footer use generated-at fingerprint
- **Hook stubs:** `ToolHookStubSpec` helpers in `auth-stub-bootstrap`; token-exchange hook authoring support
- **Release / CI:** guided-release skill (tag-only consumer quality gate); core `ci.yml` on `main`, `publish.yml` on tag

### Upgrade notes

- Rebuild core2ai, then `generate:all` + `build:generated` in api2ai/db2ai; restart MCP
- After publish: `npm run sync:core2ai-pin:npm` in consumers before VSIX release

---

## [1.0.0-rc.4] - 2026-07-07

### Changed

- **Hook stubs:** one file per hook export name (`checkToolAccessFor*` / `prepareToolCallFor*`); generated imports always follow DSL flags (write-once stub files unchanged)
- **Docs:** demo start workflow (`start:all` / `start:mcp` / `start:fixtures`), Cursor integration, MCP hosts, MCP Inspector, testing policy

### Upgrade notes

- Split combined hook stub files in consumer demos; delete legacy `${toolName}.ts` stubs; run `generate:all` + `build:generated`
- After publish: `npm run sync:core2ai-pin:npm` in api2ai/db2ai before consumer VSIX release

---

## [1.0.0-rc.3] - 2026-07-06

### Fixed

- **npm install as a dependency:** `postinstall` no longer runs `husky` and `prepare` no longer runs `tsc` when consumers install `@toolfactory.dev/core` (demo workspaces, api2ai/db2ai CLI). Lifecycle scripts run only in the core2ai git checkout (`src/` present).
- **Publish:** `prepublishOnly` runs `npm run build`; lifecycle helpers ship in the npm tarball (`scripts/npm-prepare.mjs`, `scripts/npm-postinstall.mjs`).

### Changed

- **`npm run version`:** runs `npm install` afterward so `package-lock.json` workspace version stays in sync.

### Upgrade notes

- Consumers on **1.0.0-rc.2** that added `@toolfactory.dev/core` to demo `package.json`: bump pin to **^1.0.0-rc.3** and re-run `npm install` (no `--ignore-scripts` workaround needed).

---

## [1.0.0-rc.2] - 2026-07-06

### Added

- **MCP startup banners:** catalog-style per-host cards on listen via `loggingAdapter.banner()`; orchestrator `printStartMcpSummary` for demo start (counts, warnings, compact URLs in background mode)
- **Generated `build-mcp-lib.mjs`:** demo workspaces emit `scripts/generated/build-mcp-lib.mjs` for `npm run build:mcp` shippable bundles (`dist/mcp/<module>-<host>/`)

### Changed

- **MCP host layout (Option B):** per-module `servers/<module>-<host>-mcp-server.ts` plus shared `cli/*-runtime.ts`; removed generic `cli/*-mcp-server.ts` (tools path in argv)
- **Demo script utilities:** `print-mcp-catalog.mjs` gains `printStartMcpSummary`; `warnEnvIfMissing` for optional secrets at start
- **Docs:** `mcp-hosts.md` — servers layout, foreground/background start, `build:mcp` shipping with `npm start`; cursor and api2ai-dsl paths updated

### Removed

- Auto-delete of legacy generic MCP host files on generate (maintainers clean up manually)

### Upgrade notes

- Regenerate consumers: `generate:all` + `build:generated`; point `.cursor/mcp.json` and start scripts at `generated/<product>/servers/*`
- After publish: consumers run `npm run sync:core2ai-pin:npm` before CI / VSIX release

---

### Changed

- **Hooks DSL:** per-tool `authorize` / `prepare` replaced by `hooks: { checkToolAccess, prepareToolCall }`; optional `clientMayOmit` on `prepareToolCall`
- **verifyCredential:** raw `credential: string`, void return; stub files named `verify*Credential.ts` (singular)
- **Removed:** `ModuleCredentials`, `toModuleCredentials`, and banking demo references from docs

### Upgrade notes

- Replace `authorize: true` / `prepare: true` with the `hooks` block in every `.api2ai` / `.db2ai` file
- Rename hook exports to `checkToolAccessFor*` / `prepareToolCallFor*`; regenerate with `generate:all` + `build:generated`
- Sync `@toolfactory.dev/core` pin and rebuild consumers after upgrading core2ai

---

## [1.0.0-rc] - 2026-07-03

First release-candidate of the shared Tool Factory runtime used by **api2ai** and **db2ai**.

### Added

- **`@toolfactory.dev/core` codegen package** (`./codegen` export): shared templates for MCP tool modules and four host binaries per project
- **MCP host templates:** stdio, public HTTP, passthrough HTTP, OAuth HTTP — standalone runtimes after generation (no runtime dependency on core2ai)
- **Auth pipeline render tiers:** `none`, `credential`, `full` — generated invoke path runs `verifyCredential` → `authorize` → `prepare` when hooks are declared
- **Flat MCP tool arguments:** path, query, header, and body fields at the top level of tool input; nested `pathParams` / `query` buckets are not part of the MCP schema
- **LLM-tolerant Zod coercion** in generated `normalizeInvokeOptions` (string booleans/numbers, query array splitting)
- **Architecture docs** under `docs/`: three-layer model, personas, testing strategy, Cursor and MCP Inspector guides, MCP hosts reference
- **MCP Inspector** how-to: `docs/testing/mcp-inspector.md`
- **Testing policy** for agents: E2E only via manual `/test-all` before release; no default MCP-/invoke-CI proposals (`.cursor/rules/testing-policy.mdc`)
- **CHANGELOG policy:** `docs/development/changelog-policy.md`

### Changed

- Release gate documented as `npm run check` + full `/test-all` (no duplicate MCP protocol smoke in CI)

### Upgrade notes

- Consumer repos (api2ai, db2ai) pin `@toolfactory.dev/core`; after upgrading core2ai, sync the pin and run `generate:all` + `build:generated` in each project workspace
- Regenerated `generated/**` is not versioned separately — review diffs after VSIX or pin upgrades

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
