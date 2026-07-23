---
name: commit-messages
description: >-
    Draft git commit messages for open changes (staged and unstaged) across core2ai,
    api2ai, and db2ai. Warn what not to commit. User usually commits and pushes in the
    IDE — agent does not commit/push unless explicitly asked. Use when the user asks for
    a commit message, commit messages, „Commit-Message“, „gib commit“, „dann committen“,
    or similar without asking the agent to run git commit.
---

# Commit messages (user commits in IDE)

Canonical skill: `core2ai/.cursor/skills/commit-messages/SKILL.md` (sibling layout with api2ai/db2ai). Do not duplicate in consumer repos.

## Hard rules

1. **Do not** `git commit`, `git push`, `git add` (except when the user explicitly asks you to commit).
2. Inspect **staged + unstaged + untracked** with git status/diff/log — then propose message(s).
3. Match each repo’s recent commit style (`git log -5 --oneline`): short imperative subject, focus on **why**.
4. One message **per repo** that has changes (table or list). Split messages only when the user wants separate commits and the trees clearly mix concerns.

## Procedure

For each dirty repo among `core2ai`, `../api2ai`, `../db2ai` (skip clean):

```bash
git status -sb
git diff --stat
git diff --cached --stat
git status -u --porcelain
git log -5 --oneline
```

Skim meaningful hunks if the summary is ambiguous (`git diff` / `git diff --cached`), not every line.

Draft:

| Repo | Message |
| ---- | ------- |
| `db2ai` | `…` |

Optional second line under a message only if needed for scope (rare).

## Warnings (say when relevant)

Call out before the user commits — do **not** bury this:

| Situation | Advice |
| --------- | ------ |
| Mid **guided release** consumer: pin / `vsix:version` / CHANGELOG / `generated/**` before CP4 | Prefer **one** release commit at **CP5**; don’t push registry pin + version early. Docs-only → stage only README/docs. |
| `@toolfactory.dev/core` lockfile `"link": true` | OK for local hacking; **not** for consumer release/tag CI — use registry pin (see link-vs-registry skill). |
| `.env`, `.env.local`, tokens, passwords, private keys | **Never** commit. |
| `*.vsix`, `dist/mcp/**` | Local only — do not commit. |
| Hand-edited `out/**`, `generated/**/*.js`, `node_modules` | Do not commit; fix source / regenerate (see generated-output rule). |
| Mixed docs + release bump in one dirty tree | Suggest **two** commits or stage docs now / leave release files for CP5. |
| Empty diff | Say so — no empty commit message. |

Also mention if only one of several dirty repos should be committed for the current task.

## Output shape

1. Short status (which repos dirty).
2. Table: **Repo** \| **Message**.
3. **Hinweise** bullet list only when something matters (skip if nothing to warn).

Do not dump long `git add` file lists unless the user asks what to stage.

## Related

- Guided release commits: [guided-release/SKILL.md](../guided-release/SKILL.md) (CP2/C5: message only).
- Link vs registry: [core2ai-link-vs-registry/SKILL.md](../core2ai-link-vs-registry/SKILL.md).
