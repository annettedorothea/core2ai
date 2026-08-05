---
name: toolfactory-hooks
description: >-
    Cheat sheet for Tool Factory hooks DSL and codegen (checkToolAccess, prepareToolCall,
    afterToolCall, verifyCredential, clientMayOmit). Use when editing .api2ai/.db2ai hooks,
    stub files, invoke pipeline, or regenerating demo hook maps.
---

# Tool Factory hooks — cheat sheet

Full docs: [auth-and-hooks.md](../../docs/authoring/auth-and-hooks.md) · [api2ai-dsl.md](../../docs/authoring/api2ai-dsl.md) · [db2ai-dsl.md](../../docs/authoring/db2ai-dsl.md)

## Pipeline (protected tool)

```text
verifyCredential → checkToolAccess → prepareToolCall → HTTP / SQL → afterToolCall
```

| Hook | Signatur | Zweck |
|------|----------|--------|
| `verifyCredential` | `(credential: string) => void` | Modul — Token prüfen (optional) |
| `checkToolAccess` | `(credential: string) => void` | Tool — allow/deny (403) |
| `prepareToolCall` | `(options, credential?) => options` | Tool — Args umbiegen / Defaults |
| `afterToolCall` | `(result, options, credential?) => result` | Tool — Ergebnis nach Erfolg (z. B. PDF speichern) |

**Legacy entfernt:** `authorize`, `prepare`, `ModuleCredentials`, `toModuleCredentials`.

## DSL

**Pro Operation / SQL-Block:**

```text
hooks: {
    checkToolAccess: true
    prepareToolCall: true
    afterToolCall: true
}
```

**Optional params (Schema optional, Hook füllt auf):**

```text
prepareToolCall: {
    clientMayOmit: [customerId]
}
```

**api2ai** — Modul-verify (optional):

```text
auth {
    in: header
    name: "Authorization"
    prefix: "Bearer "
    hooks: { verifyCredential: true }
}
```

**db2ai** — `auth` oder `auth { hooks: { verifyCredential: true } }`.

## Naming

| Artefakt | Muster |
|----------|--------|
| Verify-Stub-Datei | `verifyGithubCredential.ts` (singular **Credential**) |
| Verify-Funktion | `verifyGithubCredential` → export as `verifyCredential` |
| Access-Stub-Datei | `checkToolAccessForListBookings.ts` (filename = export name) |
| Prepare-Stub-Datei | `prepareToolCallForListBookings.ts` (filename = export name) |
| After-Stub-Datei | `afterToolCallForExportTodosPdf.ts` (filename = export name) |
| Access-Funktion | `checkToolAccessForListBookings(credential)` |
| Prepare-Funktion | `prepareToolCallForListBookings(options, credential?)` |
| After-Funktion | `afterToolCallForExportTodosPdf(result, options, credential?)` |

Stub-Pfad: `src/hooks/{api2ai\|db2ai}/<module>-tools/`. One hook function per file; write-once on generate; imports in `*-tools.ts` always follow DSL.

## Invoke pipeline tiers (codegen)

| Tier | When |
|------|------|
| `none` | All public, no auth |
| `credential` | Auth + protected, no per-tool hooks |
| `full` | Any `checkToolAccess`, `prepareToolCall`, or `afterToolCall` |

## Regenerate (after DSL / codegen change)

```bash
# core2ai codegen changed first:
cd core2ai && npm run build

# per consumer:
cd api2ai   # or db2ai
npm run generate:all
npm run build:generated --prefix packages/extension/demos
npm run check
```

**Never** hand-edit `generated/**` or consumer `out/embed-*/`.

## Link mode

While hacking `@toolfactory.dev/core/codegen`: [core2ai-link-vs-registry](../core2ai-link-vs-registry/SKILL.md).

## Demos (quick ref)

| Demo | Hooks |
|------|-------|
| `todo.api2ai` | `verifyCredential`; `listTodos` `hookParams.titleContains` + `afterToolCall`; `exportTodosPdf` + `afterToolCall` (PDF → temp) |
| `bookings.api2ai` | `checkToolAccess` + `prepareToolCall` (JWT, kein verify-Stub) |
| `spaceflight-news.api2ai` | public `prepareToolCall` + `clientMayOmit` |
| `orders-postgresql.db2ai` | `checkToolAccess` + `clientMayOmit` |
| `pagila-postgresql.db2ai` | public `prepareToolCall` (limit cap) |
| `sales-report.db2ai` | `topCustomersByRevenue` + `afterToolCall` (CSV → temp) |
