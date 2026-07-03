# Changelog

All notable changes to **@toolfactory.dev/core** are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com). Versioning follows [Semantic Versioning](https://semver.org).

Policy: [docs/development/changelog-policy.md](docs/development/changelog-policy.md)

---

## [Unreleased]

---

## [1.0.0-rc] - 2026-07-03

First release-candidate of the shared Tool Factory runtime used by **api2ai** and **db2ai**.

### Added

- **`@toolfactory.dev/core` codegen package** (`./codegen` export): shared templates for MCP tool modules and four host binaries per project
- **MCP host templates:** stdio, public HTTP, passthrough HTTP, OAuth HTTP — standalone runtimes after generation (no runtime dependency on core2ai)
- **Auth pipeline render tiers:** `none`, `credential`, `full` — generated invoke path runs `verifyCredential` → `authorize` → `prepare` when hooks are declared
- **Flat MCP tool arguments:** path, query, header, and body fields at the top level of tool input; nested `pathParams` / `query` buckets are not part of the MCP schema
- **LLM-tolerant Zod coercion** in generated `normalizeInvokeOptions` (string booleans/numbers, query array splitting)
- **Architecture docs** under `docs/`: three-layer model, personas, testing strategy, Cursor and Open WebUI integration guides, MCP hosts reference
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
