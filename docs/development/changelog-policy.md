# CHANGELOG policy

[← Documentation index](../README.md)

How version history and upgrade notes are maintained across **core2ai**, **api2ai**, and **db2ai**.

## Contents

- [Format](#format)
- [Per repository](#per-repository)
- [Categories](#categories)
- [What belongs in the CHANGELOG](#what-belongs-in-the-changelog)
- [Release workflow](#release-workflow)

---

## Format

- [Keep a Changelog](https://keepachangelog.com) — newest release at the top
- [Semantic Versioning](https://semver.org) for `@toolfactory.dev/core` npm tags and api2ai/db2ai **VSIX / workspace** versions
- **No** automated changelog bot in 1.0 — entries are written manually at release time

---

## Per repository

| Repo    | Version source                                           | CHANGELOG covers                                              |
| ------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| core2ai | `@toolfactory.dev/core` in `package.json`, git tags `v*` | Shared codegen templates, MCP host renderers, runtime helpers |
| api2ai  | Workspace / VSIX `package.json`                          | `.api2ai` DSL, OpenAPI loader, generator, extension, demos    |
| db2ai   | Workspace / VSIX `package.json`                          | `.db2ai` DSL, SQL validation, generator, extension, demos     |

Each consumer repo pins `@toolfactory.dev/core` (sibling checkout or npm). When core2ai codegen changes behavior, note the pin refresh in **both** consumer CHANGELOGs under **Changed** or **Upgrade notes**.

---

## Categories

| Section        | Use for                                                           |
| -------------- | ----------------------------------------------------------------- |
| **Added**      | New DSL keywords, generator output, hosts, validator rules, demos |
| **Changed**    | Behavior or shape of generated code, CLI flags, hook contracts    |
| **Deprecated** | Features scheduled for removal (include target version)           |
| **Removed**    | Deleted features                                                  |
| **Fixed**      | Bugs affecting authors or runtime                                 |
| **Security**   | Auth, credential handling, injection surfaces                     |

---

## What belongs in the CHANGELOG

**Include:**

- Breaking DSL grammar, generator output, MCP host CLI flags, hook function signatures
- New validator errors or warnings authors will see in the editor
- OpenAPI / SQL support boundary changes
- Demo harness or `/test-all` scope changes that affect release verification

**Upgrade notes block** (when VSIX or pin changes matter):

```markdown
### Upgrade notes

- After VSIX upgrade: run `generate:all` and `build:generated` in each project workspace; review `generated/**` diff.
- When upgrading `@toolfactory.dev/core`: run `sync-core2ai-pin` (or equivalent) in api2ai/db2ai, then regenerate.
```

**Omit:**

- Every commit, internal refactors with no author-facing impact
- Regenerated demos that only reflect a no-behavior pin bump

---

## Release workflow

Extends [guided-release](../../.cursor/skills/guided-release/SKILL.md):

1. **core2ai:** CHANGELOG + `npm run version` → commit → tag → npmjs (**C1–C4**)
2. **Consumer (per api2ai / db2ai):** registry pin + CHANGELOG + `vsix:version` (**CP1**); `vsix:prepare` (**CP2**, regenerates `mcpServerVersion` in demos); **one commit** incl. `generated/**` (**CP3**); then `vsix:build` → manual test → `vsix:release` (**CP4–CP6**)
3. Copy relevant CHANGELOG sections to GitHub release notes
4. Before **1.0** or **1.0.0-rc** tag: `npm run check` in affected repos + full **`/test-all`**

---

## README link (consumer repos)

Add near the pre-release banner (when removing banner at 1.0):

```markdown
See [CHANGELOG.md](CHANGELOG.md) for version history and upgrade notes.
```

---

## See also

- [Testing strategy](../architecture/05-testing-strategy.md)
- [Documentation index](../README.md)

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
