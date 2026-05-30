---
name: Abschluss Doku Release
overview: 'Verify → Architektur-Doku (3 Ebenen: DSL/VSIX → generierte MCP-Artefakte → Cursor/Agent) → Release-Workflows per Dry-Run dokumentieren → echter Release am Ende.'
todos:
    - id: plan-file
      content: Abschluss-Plan in core2ai/.cursor/plans/ (Deckel-Plan bleibt bis manuelles Löschen)
      status: completed
    - id: verify-auto
      content: 'Phase 1: build/check/test + generate:all/check:generated in allen drei Repos'
      status: pending
    - id: verify-manual
      content: 'Phase 1: Extension Save/Generate, test:smoke, optional MCP in Cursor'
      status: pending
    - id: docs-arch
      content: 'Phase 2: docs/01–04 nach Ebenenmodell + Hub; cheatsheet; core2ai↔siblings'
      status: pending
    - id: release-dry-run-doc
      content: 'Phase 3: Dry-Run; workflows/01 (core2ai library) + 02/03 (VSIX) aus Erfahrung'
      status: pending
    - id: workflows-prio
      content: 'Phase 4: 04-version-bump, 10-daily, 05-fresh-clone, 06–07 DSL, Rest'
      status: pending
    - id: docs-wire
      content: 'Phase 5: README Documentation-Links → core2ai/docs/'
      status: pending
    - id: release-real
      content: 'Phase 6: echter @core2ai/core-Tag + Consumer-Pin; optional VSIX prerelease'
      status: pending
    - id: followup-extension-toolchain-version
      content: 'Follow-up: Extension Status/Command mit VSIX + @core2ai/core Version (api2ai + db2ai)'
      status: pending
    - id: followup-generated-typecheck-ide
      content: 'Follow-up: invoke-render.ts `parts: string[]` (api2ai+db2ai regen), IDE tsconfig.generated, optional type-aware ESLint'
      status: pending
isProject: false
---

# Abschluss: Verify, Architektur (3 Ebenen), Release-Doku, Release

## Ebenenmodell (verbindlich für die Doku)

**Wichtig:** Das unterscheidet sich vom alten Deckel-Plan (core2ai / Consumer / generated). Die Architektur-Doku folgt **deinem** Modell.

### Übersicht

```mermaid
flowchart TB
  subgraph L1 [Ebene 1 Sprache und Extension]
    Langium["Langium: Grammar, Validator, Completion"]
    DSL[".api2ai / .db2ai DSL"]
    GenCLI["CLI + Extension Codegen"]
    Core2ai["@core2ai/core\n(MCP-Host-Bundle, Codegen-Bootstrap)"]
    VSIX["VSIX\n(vscode-api2ai / vscode-db2ai)"]
    Langium --> DSL
    DSL --> GenCLI
    Core2ai --> GenCLI
    GenCLI --> VSIX
  end
  subgraph L2 [Ebene 2 Laufzeit-Artefakte im Projekt]
    Tools["*-tools.ts / .mjs\n(invokeTool, Schemas)"]
    Host["mcp-serve.mjs\n(stdio MCP host)"]
    Auth["src/auth/*.ts\n(checked access)"]
    VSIX -->|"generate on save / CLI"| Tools
    VSIX --> Host
    GenCLI --> Auth
    Tools --> Host
  end
  subgraph L3 [Ebene 3 Cursor und Agent]
    McpJson[".cursor/mcp.json"]
    Agent["Agent / Chat\n(tool calls)"]
    Host --> McpJson
    Tools --> McpJson
    McpJson --> Agent
  end
```

| Ebene | Was du meinst                                                                                | Ergebnis / Artefakt                                              |
| ----- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **1** | Langium, DSL, Code Generator; **core2ai** als geteilte Bibliothek; **Release** der Extension | **VSIX** (installierbare api2ai/db2ai-Extension)                 |
| **2** | Was die VSIX (bzw. CLI im Monorepo) aus der DSL erzeugt                                      | **MCP-Server** (`mcp-serve.mjs`) + **MCP-Tools** (`*-tools.mjs`) |
| **3** | Einbindung in Cursor, Test mit dem Agent                                                     | Konfigurierte MCP-Server, Tool-Aufrufe im Chat                   |

### Ebene 1 — Langium, DSL, Code Generator → VSIX

**Repos (Geschwister):**

| Repo                   | Rolle in Ebene 1                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **api2ai** / **db2ai** | Langium-Grammar (`.langium`), Validator, Completion, **Generator** (`packages/cli`), **VS Code Extension** (`packages/extension`) |
| **core2ai**            | Geteilte Teile: MCP-Host (`mcp-host`), Generate-Validierung, Auth-Stub-Bootstrap, Pin-Skripte — **keine** eigene DSL              |

**Zusammenspiel core2ai ↔ Siblings:**

- api2ai/db2ai **pinnen** `@core2ai/core` per Git-Tag (`core2ai:use-pin`) für reproduzierbare Builds.
- Während Entwicklung: `core2ai:use-local` (sibling `../core2ai`).
- Nach Änderung an **mcp-host** oder **codegen** in core2ai: Library-Release (Tag) → Consumer `use-pin` → `bundle:mcp-runtime` → `generate:all`.
- **Zwei Release-Arten** (in Doku trennen, nicht vermischen):
    1. **@core2ai/core Library-Release** — Git-Tag auf **core2ai**, Pin in api2ai/db2ai (Workflow `01-core2ai-library-release.md`).
    2. **VSIX-Release** — Extension-Version in `packages/extension/package.json`, lokal bauen/testen, `release:vsix` → GitHub prerelease (Workflow `03-vsix-github-release.md`).

**Output Ebene 1 für Endnutzer:** installierbare **VSIX** (oder Extension Development Host im Monorepo).

**Doku-Datei:** [`docs/02-layer1-dsl-extension-core2ai.md`](docs/02-layer1-dsl-extension-core2ai.md)

Inhalt grob:

- Langium-Pipeline (`langium:generate` → generated grammar)
- DSL-Dateien, OpenAPI vs SQL
- Generator + Extension (save → generate)
- Wo **core2ai** eingehängt wird (bundle, validation, stubs)
- Monorepo vs „Create demo workspace“ aus VSIX
- Wie man VSIX baut (`extension:vsix -w packages/extension`)

---

### Ebene 2 — VSIX erzeugt MCP-Server und MCP-Tools

**Fokus:** Was nach `generate` im **Projekt-Workspace** liegt (z. B. `packages/extension/demos/generated/`).

**Doku-Reihenfolge innerhalb Ebene 2** (wie von dir vorgeschlagen):

1. **Zuerst:** Wie **MCP-Server** und **Tools** zur Laufzeit zusammenspielen (ein Tool-Call: stdio → host → `invokeTool` → HTTP/SQL).
2. **Dann:** Wie die **VSIX/Extension** das erzeugt (Grammar → AST → Validator → Generator).

**Artefakte:**

| Artefakt   | Pfad (typisch)                | Rolle                                                  |
| ---------- | ----------------------------- | ------------------------------------------------------ |
| Tool-Modul | `generated/tools/*-tools.mjs` | `invokeTool`, Input-Schema, OpenAPI/SQL-Aufruf         |
| MCP-Host   | `generated/cli/mcp-serve.mjs` | stdio, lädt Tool-Modul, `--base-url-env`, `--auth-env` |
| Auth-Stubs | `src/auth/*.ts`               | checked access, `check*Parameters`                     |

**Doku-Datei:** [`docs/03-layer2-mcp-server-and-tools.md`](docs/03-layer2-mcp-server-and-tools.md)

Inhalt grob:

- Ablaufdiagramm Tool-Call (ohne Cursor)
- Grob Grammatik/Validator (was wird wann geprüft)
- Generate-Pipeline (`parse` / `validate` / `generate`)
- `bundle:mcp-runtime` und Kopie in `generated/cli/`
- api2ai vs db2ai Unterschiede (OpenAPI-Pfade vs SQL/env)

---

### Ebene 3 — Integration in Cursor und Test mit dem Agent

**Fokus:** Konfiguration und Nutzung — nicht Generator-Quellcode.

- `.cursor/mcp.json` (Server-Einträge, `env`, args zu `mcp-serve.mjs` + tools path)
- Server aktivieren, Agent wählt Tools
- Manuell testen: Demos-README-Prompts, `test:smoke`, `test:e2e`
- Optional: Extension Command „Create demo workspace“

**Doku-Datei:** [`docs/04-layer3-cursor-and-agent.md`](docs/04-layer3-cursor-and-agent.md)

Kann am Anfang den **Runtime-Flow** aus Ebene 2 kurz wiederholen (Cursor-Sicht: „was passiert wenn der Agent ein Tool aufruft?“), dann Setup-Schritte.

---

### Hub und Übersicht

| Datei                                                                    | Inhalt                                                |
| ------------------------------------------------------------------------ | ----------------------------------------------------- |
| [`docs/README.md`](docs/README.md)                                       | Hub: Links 01–04, workflows/, Daily commands (kurz)   |
| [`docs/01-three-layers-overview.md`](docs/01-three-layers-overview.md)   | Dein 3-Ebenen-Modell + Diagramm + „welche Repo wofür“ |
| [`docs/consumer-build-cheatsheet.md`](docs/consumer-build-cheatsheet.md) | „Ich ändere X → Y“ mit Verweis auf Ebene + Workflow   |

Alte Deckel-Zuordnung (`01-three-layers` = Pin, `02-mcp-stdio` separat) wird **ersetzt** durch obige 01–04.

---

## Was vom alten Deckel-Plan noch gilt

| Todo       | Status / Anpassung                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| verify-all | Unverändert — vor Release-Dry-Run                                                                        |
| docs-wire  | README verlinken auf `docs/01` (Ebenen-Übersicht), nicht auf veraltetes Modell                           |
| release    | **Zwei** dokumentierte Abläufe: core2ai-Library (Tag/Pin) **und** optional VSIX; echter Lauf **am Ende** |

## Pläne

- **Aktiv:** [`abschluss_doku_release.plan.md`](abschluss_doku_release.plan.md)
- **Historisch:** [`docs_und_aufraeumen_deckel.plan.md`](docs_und_aufraeumen_deckel.plan.md) — bei Bedarf manuell löschen (kein `done/`-Ordner)

---

## Reihenfolge

### Phase 1 — Verify (auto + manuell)

Unverändert: `build` / `check` / `test` in core2ai, api2ai, db2ai; `generate:all`, `check:generated`; api2ai `test:e2e`; db2ai `test:e2e` (Docker).

Manuell: Extension Save, `test:smoke`, ein MCP-Server in Cursor — das ist **Ebene-3-Verifikation**.

---

### Phase 2 — Architektur-Doku (dein Modell)

Reihenfolge beim Schreiben:

1. **01** — Übersicht + Diagramm (dieser Abschnitt ausformulieren)
2. **02** — Ebene 1 (Langium, core2ai, Siblings, VSIX-Build)
3. **03** — Ebene 2 (zuerst Runtime Server↔Tools, dann Erzeugung durch Generator)
4. **04** — Ebene 3 (Cursor, mcp.json, Agent, Tests)
5. **cheatsheet** + Hub-TOC

Sprache: READMEs EN; Architektur/Workflows **DE oder EN** — einmal festlegen (Vorschlag: DE für Workflows, EN für `docs/01–04` wie READMEs).

---

### Phase 3 — Release-Workflows per Dry-Run dokumentieren

**Dry-Run** (bis vor Tag/Push): zwei Checklisten ableiten:

| Workflow                                  | Inhalt                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `workflows/01-core2ai-library-release.md` | Tag `@core2ai/core`, `use-pin`, bundle, generate — **Ebene-1-Infrastruktur**              |
| `workflows/02-vsix-build-local-test.md`   | VSIX lokal, Extension Host, Demos                                                         |
| `workflows/03-vsix-github-release.md`     | VSIX lokal bauen/testen, dann `release:vsix` (GitHub prerelease) — **Ebene-1-Endprodukt** |

Skill [`guided-release/SKILL.md`](../.cursor/skills/guided-release/SKILL.md) — Checkpoint-Flow (Library optional, Preview, VSIX); Workflow 01 später menschliche Kopie.

---

### Phase 4–6

Wie zuvor: weitere Workflows (04 version-bump, 10 daily, …), docs-wire, **echter Release** zuletzt.

---

## Follow-up (nach Release / Verify): Toolchain-Version in der Extension sichtbar

**Ziel:** Direkt in Cursor sehen, welche **VSIX/Extension-Version** (api2ai bzw. db2ai) und welche **@core2ai/core**-Version aktiv sind — ohne MCP `serverInfo` zu verbiegen.

**Warum nicht MCP `serverInfo.version`:** `mcpServerVersion` im Generator ist heute die **CLI-/Generator-Version**, nicht die spätere MCP-Tool-API. Generator/DSL-Toolchain gehört zu **Ebene 1 (VSIX)**, nicht zur MCP-Protokoll-Identität.

### Was anzeigen

| Teil         | Quelle                                                                     | Beispiel |
| ------------ | -------------------------------------------------------------------------- | -------- |
| **Consumer** | `packages/extension/package.json` (`vscode-api2ai` / `vscode-db2ai`)       | `0.0.2`  |
| **Core**     | Aufgelöstes `@core2ai/core` (Embed/`node_modules`, gleicher Stand wie Pin) | `0.0.5`  |

Anzeigeformat (Vorschlag): `api2ai 0.0.2 · core 0.0.5` (db2ai analog).

### UI (einfach, sofort sichtbar)

1. **Statusleiste** — permanentes Item beim Extension-Aktivieren (nur wenn api2ai/db2ai-Extension aktiv).
2. **Command Palette** — z. B. `api2ai: Show toolchain versions` / `db2ai: Show toolchain versions` → kurze Meldung oder Output-Kanal mit beiden Versionen (+ optional CLI/Language-Paket später).
3. Optional später: gleicher Text im **Welcome/About** oder Output-Kanal „api2ai“ bei Aktivierung.

**Ort:** `packages/extension/src/` in **api2ai** und **db2ai** (parallele Implementierung, gleiches Muster).

### Technik (Überblick)

- Extension-Version: `context.extension.packageJSON.version`.
- Core-Version: `@core2ai/core/package.json` aus dem Pfad, den die Extension ohnehin für CLI/Generate nutzt (Embed-Home oder Workspace-`node_modules`); Fallback `"unknown"` + Hinweis wenn Pin fehlt.
- Keine Änderung an `mcp-host`, Generator oder `mcpServerVersion` nötig.
- Kleiner Test (Unit oder Integration) für Version-Auflösung, wo sinnvoll.

### Akzeptanz

- Nach VSIX-Install / Extension Development Host: Statusleiste zeigt **beide** Versionen.
- Nach `core2ai:use-pin` + Extension-Reload: **Core**-Teil aktualisiert sich (Consumer-Teil nur bei neuem VSIX).
- Kein Einfluss auf MCP-Server-Namen, Tools oder `serverInfo`.

### Doku

- Kurz in **Ebene-1-Doku** (`docs/02-layer1-dsl-extension-core2ai.md`): „Toolchain-Version in der Statusleiste prüfen“.
- Optional Verify-Checkliste Phase 1: ein Blick auf Statusleiste nach Pin/VSIX.

### Abhängigkeit

**Nach** guided-release CP5/CP6 (Consumer-Pin committed) oder als nächstes VSIX-Feature — kein core2ai-Tag zwingend, außer Core-Version-Auflösung braucht Hilfs-Export in `@core2ai/core` (nur falls `require('@core2ai/core/package.json')` im Extension-Bundle scheitert; erst prüfen, dann entscheiden).

### Nicht in diesem Follow-up

- MCP `serverInfo` mit Generator-Version füllen.
- Provenance-JSON in `generated/` (optional später).
- DSL-eigene `mcp { version … }` (später, separates Thema).

---

## Follow-up: Generator-Fix + Typecheck/IDE (`github-tools` `never[]`)

**Auslöser:** `api2ai/packages/extension/demos/generated/tools/github-tools.ts` (~Z. 309) — IDE: `parts.push(String(element))` → `string` not assignable to `never` wegen `const parts = []` in `appendSerializedQueryParams` (OpenAPI query-array-Serialisierung).

### 1 — Generator-Fix (Pflicht, zuerst)

**Ursache:** Template in **`api2ai/packages/cli/src/generator/invoke-render.ts`** (query-array-Zweig) erzeugt untypisiertes `const parts = []` → unter strict inference `never[]`.

**Änderung:**

```ts
const parts: string[] = [];
```

**Danach (Reihenfolge):**

1. **api2ai:** `npm run build` → `npm run generate:all` → `npm run check:generated`
2. **db2ai:** gleiches Template prüfen (`packages/cli/src/generator/invoke-render.ts` — ggf. identisch anpassen) → `generate:all` → `check:generated`
3. Regenerierte `generated/tools/*` committen (kein Hand-Patch in generated)

**Verify:** `github-tools.ts` ohne IDE-Diagnostic; `mcpServerVersion`/Generate unverändert außer Regenerate.

Regel: [codegen-generated-quality.mdc](../.cursor/rules/codegen-generated-quality.mdc) in api2ai/db2ai.

### 2 — Warum Gates nicht blockiert haben

| Gate                          | `check:generated`?                                        |
| ----------------------------- | --------------------------------------------------------- |
| pre-commit (`npm run check`)  | Ja                                                        |
| pre-push                      | Ja                                                        |
| `release:vsix` (publish only) | Nein — baut nicht; VSIX muss aus CP6/8 Preview existieren |

`npm run typecheck:generated` war **exit 0** — CLI blockiert nicht; Problem vor allem **IDE** (orphan file, siehe unten).

### 3 — IDE / DX (optional, nach Generator-Fix)

- `packages/extension/demos/tsconfig.json`: `references` → `tsconfig.generated.json`, damit Cursor generated tools dem gleichen Projekt zuordnet wie CI.
- Optional: type-aware ESLint für `generated/tools/**/*.ts` (langsamer in Hooks).

### Akzeptanz

- [ ] Generator-Fix in **invoke-render.ts**, beide Consumer regeneriert
- [ ] `check:generated` grün in api2ai + db2ai
- [ ] `github-tools.ts` in Cursor ohne `never[]`-Fehler
- [ ] Kein manuelles Editieren von `generated/**`

**Abhängigkeit:** Nach db2ai VSIX-Release (CP8/9) oder kleiner PR nur Generator — kein core2ai-Tag nötig.

---

## Erfolg

- Ebene 1/2/3 sind in `docs/01` klar und entsprechen deiner VSIX-zentrierten Sicht
- core2ai vs api2ai/db2ai und Library- vs VSIX-Release sind getrennt erklärt
- Nächster Library-Release: Workflow 01; nächstes VSIX: Workflow 03
- Agent-Test (Ebene 3) ist in Doku und Verify-Checkliste verankert

---

#Col3:23
