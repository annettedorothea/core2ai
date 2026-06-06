---
name: Demo-Scripts core2ai Codegen
overview: Nur MCP-Host-Skripte (HTTP/OAuth Registry, Start, Kill) aus api2ai/db2ai nach core2ai extrahieren und als generated/scripts emittieren. Demo-Infrastruktur (init, Test-DBs, Mock-APIs, IdP, kill-all) bleibt handgeschrieben in den Demos — gehört nicht in den Generator.
todos:
  - id: scope-boundary
    content: "Grenze dokumentieren: Generator = MCP-Hosts; Infra = scripts/infra/ handgeschrieben (init, kill-all, docker, generate optional separat)"
    status: cancelled
  - id: core2ai-mcp-render
    content: "core2ai: render-mcp-http/oauth-demos + start/kill + kill-listeners-on-port + writeGeneratedDemosMcpScripts + Banner + Tests"
    status: cancelled
  - id: mcp-hosts-config
    content: "demos-mcp-hosts.config.json (schmal): httpDemos, oauthHttpDemos, initDemoNames — aus mcp-*-demos.mjs extrahieren"
    status: cancelled
  - id: wire-generate
    content: writeGeneratedDemosMcpScripts in db2ai/api2ai generator.ts; erste Emission generated/scripts/ committen
    status: cancelled
  - id: stubs-migration
    content: "scripts/*.mjs Stubs nur für MCP-Skripte; Infra-Skripte in scripts/infra/ belassen; init importiert generated Registry"
    status: cancelled
  - id: infra-handwritten
    content: "init.mjs, kill-all-demos.mjs, kill-demo-databases.mjs produktspezifisch handhalten; aus Generator-Scope entfernen"
    status: cancelled
  - id: verify
    content: npm run check; demo:mcp-http:* / demo:mcp-oauth:* smoke-test; init weiterhin manuell
    status: cancelled
isProject: false
---

# MCP-Host-Scripts nach core2ai (schmaler Scope)

> **Status: zurückgestellt** (2026-06-06) — Aufwand lohnt sich vorerst nicht. Scripts bleiben wie bisher dupliziert in api2ai/db2ai `scripts/`. Bei Bedarf später mit schmalem Scope (nur MCP-Launch, Infra handgeschrieben) wieder aufnehmen.

## Kernerkenntnis: Generator ≠ Demo-Infrastruktur

Im echten Leben braucht der Endnutzer nach Codegen im Wesentlichen:

| Transport | Was der Nutzer braucht |
|-----------|------------------------|
| **stdio** | Eintrag in `mcp.json` → `generated/cli/stdio-mcp-server.js` (existiert bereits) |
| **HTTP** | MCP-Host starten (Port, Env, Tools-Modul) |
| **OAuth HTTP** | MCP-Host starten (IdP-URL, Scope, Token-Validation, Port) |

Alles andere in den Demos ist **Test-/Dev-Infrastruktur** — nicht MCP-Produktlogik:

- Docker-Test-DBs (`db:up:all`, `kill-demo-databases.mjs`)
- Mock-APIs (`bookings-api`, `todo-api`, `cakes-api`)
- Test-OAuth-IdP (`oauth-idp/server.mjs`)
- `init.mjs` (Orchestrierung: install → Infra hoch → generate → MCP starten)
- `kill-all-demos.mjs` (Infra + MCP gemeinsam stoppen)

**Diese Infra-Skripte gehören nicht in `generateOutput` / core2ai-Codegen.** Sie bleiben handgeschrieben, produktspezifisch, im Demos-Workspace.

## Zielbild (revidiert)

```mermaid
flowchart TB
  subgraph generator ["Generator / core2ai — MCP-relevant"]
    dsl["*.db2ai / *.api2ai"]
    cliGen["generateOutput"]
    mcpHosts["generated/cli/*-mcp-server.ts"]
    mcpScripts["generated/scripts/mcp-*.mjs"]
    dsl --> cliGen
    cliGen --> mcpHosts
    cliGen --> mcpScripts
  end

  subgraph infra ["Demos — handgeschrieben, nicht generiert"]
    init["scripts/infra/init.mjs"]
    killAll["scripts/infra/kill-all-demos.mjs"]
    docker["db:* / kill-demo-databases"]
    mockApi["bookings-api/, oauth-idp/"]
    init --> mockApi
    init --> docker
    init -->|"import buildHostLaunch"| mcpScripts
  end

  subgraph user ["Endnutzer (Produktion)"]
    mcpJson["mcp.json oder start-mcp-*"]
    mcpJson --> mcpScripts
  end
```

- **Generiert:** `generated/scripts/` — nur MCP-Host-Launch (Registry, Start, Kill, Port-Utility).
- **Handgeschrieben:** `scripts/infra/` — Demo-Setup; darf generated MCP-Registry importieren.
- **Stubs:** `scripts/start-mcp-*.mjs` → Re-Export aus `generated/scripts/` (stabile npm-Pfade).

## Was in core2ai / Generator kommt

Unter `core2ai/src/codegen/demo-scripts/` — **nur MCP-Host-Launch:**

| Render-Modul | Zweck |
|--------------|-------|
| `render-mcp-http-demos.ts` | Registry + `buildHostLaunch` + `listHttpPorts` |
| `render-mcp-oauth-demos.ts` | Registry + `buildOAuthHostLaunch` + `listOAuthHttpPorts` |
| `render-start-mcp-http.ts` / `-all.ts` | Foreground/detached MCP HTTP start |
| `render-start-mcp-oauth.ts` | OAuth MCP start |
| `render-kill-mcp-http-all.ts` / `render-kill-mcp-oauth.ts` | Port-basiertes Stoppen |
| `render-kill-listeners-on-port.ts` | Utility (von Kill-Skripten + ggf. oauth-idp/kill-server) |
| `generated-script-banner.ts` | `@generated from @core2ai/core` |
| `write-generated-demos-mcp-scripts.ts` | Schreibt nach `generated/scripts/` |

`buildHostLaunch` / `buildOAuthHostLaunch`: Produktunterschied (`connectionEnv` vs `baseUrlEnv`) über `product: "api2ai" | "db2ai"` aus Config.

Export: `writeGeneratedDemosMcpScripts` in [index.ts](core2ai/src/codegen/index.ts).

## Was **nicht** in den Generator kommt

| Script | Grund | Verbleib |
|--------|-------|----------|
| `init.mjs` | Orchestriert Demo-Infra + Dev-Setup | `scripts/infra/init.mjs` (handgeschrieben, pro Produkt) |
| `kill-all-demos.mjs` | Stoppt Infra + MCP | `scripts/infra/kill-all-demos.mjs` |
| `kill-demo-databases.mjs` | Docker-Test-DBs (db2ai) | `scripts/infra/kill-demo-databases.mjs` |
| `generate.mjs` / `generate-all.mjs` | CLI-Spawn (VSIX-Embed) — Codegen-**Werkzeug**, kein MCP-Runtime | vorerst handgeschrieben in `scripts/` (identisch, config-driven via `demos-generate.config.json`); optional später separater core2ai-Copy-Schritt **ohne** Anbindung an `generateOutput` |
| `load-env-local.mjs` | Von Infra + MCP genutzt | kleines shared Hand-Script in `scripts/` oder Import aus generated Utility |

**Entfernt aus vorigem Plan:** `render-init.ts`, `render-kill-all-demos.ts`, `render-kill-demo-databases.ts`, `initPipeline` / `detachedProcesses` / `dockerContainers` in Config.

## Config (schmal)

Neu: [`demos-mcp-hosts.config.json`](db2ai/packages/extension/demos/demos-mcp-hosts.config.json) — **nur MCP-Host-Metadaten**, keine Infra:

```json
{
  "product": "db2ai",
  "httpDemos": {
    "pagila": {
      "tools": "pagila-tools.js",
      "connectionEnv": "PAGILA_DATABASE_URL",
      "defaultConnection": "postgresql://postgres:postgres@localhost:55432/pagila",
      "portEnv": "PAGILA_HTTP_PORT",
      "defaultPort": 4853,
      "credentialValidation": "static",
      "authExpectedEnv": "MCP_AUTH_EXPECTED"
    }
  },
  "oauthHttpDemos": {
    "orders": {
      "tools": "orders-database-tools.js",
      "oauthIdpUrlEnv": "ORDERS_DATABASE_OAUTH_IDP_URL",
      "defaultOAuthIdpUrl": "http://127.0.0.1:4863",
      "portEnv": "ORDERS_DATABASE_OAUTH_HTTP_PORT",
      "defaultPort": 4871,
      "tokenValidation": "oidc",
      "oauthScope": "orders-database"
    }
  },
  "httpInitDemoNames": ["pagila"],
  "oauthInitDemoNames": ["orders"]
}
```

Bestehende [`demos-generate.config.json`](db2ai/packages/extension/demos/demos-generate.config.json) unverändert (CLI-Auflösung).

**Gate für Emission:** `demos-generate.config.json` + `demos-mcp-hosts.config.json` vorhanden.

## Integration in generate-Pipeline

In [generator.ts](db2ai/packages/cli/src/generator.ts) / api2ai — nach `writeGeneratedDemosTestSupport`:

```typescript
writeGeneratedDemosMcpScripts(projectRoot);
```

Nur bei DSL-Codegen — Infra-Skripte werden **nicht** mitregeneriert.

Config-Änderung an MCP-Hosts ohne DSL-Regen: `npm run generate:scripts` (dünner Stub, ruft nur `writeGeneratedDemosMcpScripts`).

## Verzeichnisstruktur nach Migration

```
demos/
  demos-generate.config.json      # CLI (bestehend)
  demos-mcp-hosts.config.json     # MCP Registry (neu, schmal)
  generated/
    cli/                          # MCP Hosts (bestehend)
    scripts/                      # NEU: nur MCP-Launch
      mcp-http-demos.mjs
      mcp-oauth-demos.mjs
      start-mcp-http.mjs
      start-mcp-http-all.mjs
      start-mcp-oauth.mjs
      kill-mcp-http-all.mjs
      kill-mcp-oauth.mjs
      kill-listeners-on-port.mjs
  scripts/
    generate.mjs                  # handgeschrieben (CLI spawn)
    generate-all.mjs
    load-env-local.mjs
    start-mcp-http.mjs            # Stub → ../generated/scripts/...
    ... (Stubs für MCP only)
    infra/
      init.mjs                    # handgeschrieben, produktspezifisch
      kill-all-demos.mjs
      kill-demo-databases.mjs     # db2ai only
```

`init.mjs` importiert `buildHostLaunch` aus `../../generated/scripts/mcp-http-demos.mjs` statt lokaler Kopie.

## Stubs (nur MCP-Skripte)

```javascript
#!/usr/bin/env node
import '../generated/scripts/start-mcp-http.mjs';
```

npm-Scripts `demo:mcp-http:*`, `demo:mcp-oauth:*` bleiben auf Stubs.
`init` / `demo:kill-all` zeigen auf `scripts/infra/`.

## VSIX / Bundle

[demo-bundle-required.json](db2ai/packages/extension/demos/demo-bundle-required.json):

- `generated/scripts/**` + `demos-mcp-hosts.config.json` aufnehmen
- MCP-Stubs in `scripts/`
- Infra-Skripte in `scripts/infra/` (weiterhin vollständig committen)

## Dokumentation

README Demos — zwei Abschnitte:

1. **Produktion / Endnutzer:** stdio via `mcp.json`; HTTP/OAuth via `npm run demo:mcp-http:…` / `demo:mcp-oauth:…` (generierte MCP-Launcher).
2. **Dev-Setup:** `npm run init` startet zusätzlich Test-Infra (DBs, Mock-APIs, IdP) — nur für Demos, nicht Teil des Generators.

Rules: `generated/scripts/**` in [generated-output-do-not-edit.mdc](core2ai/.cursor/rules/generated-output-do-not-edit.mdc); Trigger in [demos-build-generated.mdc](db2ai/.cursor/rules/demos-build-generated.mdc) nur für MCP-Script-Templates.

## Umsetzungsphasen

### Phase 1 — Scope + Config
- `demos-mcp-hosts.config.json` für db2ai und api2ai aus bestehenden `mcp-*-demos.mjs` extrahieren
- Infra-Skripte nach `scripts/infra/` verschieben (ohne Logik-Änderung)

### Phase 2 — core2ai MCP-Render
- Render-Module für Registry + Start/Kill + `kill-listeners-on-port`
- `writeGeneratedDemosMcpScripts` + Unit-Tests (db2ai/api2ai Fixtures)

### Phase 3 — Generator-Anbindung + Emission
- `writeGeneratedDemosMcpScripts` in beide `generator.ts`
- Erste Emission + Commit `generated/scripts/**`
- MCP-Stubs in `scripts/`; `init.mjs` auf generated Registry umstellen

### Phase 4 — Aufräumen
- Alte `scripts/mcp-*-demos.mjs`, Start/Kill-Vollversionen entfernen
- Externe Importe (`oauth-idp/kill-server.mjs`) auf generated oder Stub
- `generate.mjs` / `generate-all` vorerst unverändert handhalten (optional später deduplizieren)

### Phase 5 — Verify
- `npm run check` in core2ai, db2ai, api2ai
- Smoke: `demo:mcp-http:pagila`, `demo:mcp-oauth:orders`, dann `init` + `kill-all`

## Nicht-Ziele

- Init/Kill-all/Docker/Mock-API/IdP in core2ai oder Generator
- `@core2ai/core` als Runtime-Dependency in kopierten Demos
- TypeScript-Kompilierung der `.mjs`-Scripts
- Automatische Ableitung der MCP-Registry aus DSL in Phase 1 (Config bleibt manuell; später optional aus Transport-Metadaten im Model)

## Risiken / Mitigation

| Risiko | Mitigation |
|--------|------------|
| init bricht ohne generated/scripts | init erst nach `generate:all` + commit; README-Reihenfolge |
| Zwei Config-Dateien | klare Trennung generate vs mcp-hosts; README |
| generate.mjs weiter dupliziert | bewusst außerhalb Scope; optional separater Dedup-Schritt |
