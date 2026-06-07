---
name: SQL Server + Named Params
overview: db2ai erhält einen dritten Dialekt `sqlserver`, die DSL wechselt auf Named Params (`limit:` + `:limit`, Breaking Change — keine `$1`-Legacy-Unterstützung), und die Demos bekommen einen vierten Docker-Service mit eigener T-SQL-Test-DB (orders-database-Spiegel).
todos:
  - id: named-params-grammar
    content: Grammar + sql-params + Validator auf Named Params (`limit:` + `:limit`) umstellen, `name:` entfernen
    status: pending
  - id: codegen-pg-mysql
    content: invoke-render + db-query-codegen für Named-Placeholder-Rewrite (pg/mysql/sqlserver)
    status: pending
  - id: migrate-demos
    content: pagila.db2ai, sakila.db2ai, orders-database.db2ai vollständig auf Named Params migrieren
    status: pending
  - id: sqlserver-dialect
    content: dialect.ts, invoke-render (mssql), generator.ts, core2ai runtime für sqlserver
    status: pending
  - id: docker-sqlserver
    content: Docker Compose (mssql server) + init-T-SQL + test support + .env.example
    status: pending
  - id: sqlserver-demo-dsl
    content: orders-database-sqlserver.db2ai + Integrationstest + optional mcp.json
    status: pending
  - id: explain-dry-run
    content: sql-db-validator auf EXPLAIN/dry-run umstellen (postgres EXPLAIN, mysql EXPLAIN, sqlserver SET NOEXEC ON) — keine Live-DML mehr beim Speichern
    status: pending
  - id: regenerate-verify
    content: core2ai build → generate:all → build:generated → npm run check in db2ai
    status: pending
isProject: false
---

# SQL Server + Named Params für db2ai

## Antworten auf deine Fragen

### Wo wird der DB-Dialekt berücksichtigt?

**Beides — primär zur Codegen-Zeit, mit Runtime-Guards.** Es gibt keine separate Config-Datei; der Dialekt steht **in der `.db2ai`-Datei**:

```db2ai
database postgres env "PAGILA_DATABASE_URL"   // implizit postgres
database mysql env "SAKILA_DATABASE_URL"
database sqlserver env "ORDERS_SQLSERVER_DATABASE_URL"  // neu
```

```mermaid
flowchart LR
    DSL[".db2ai\n(database dialect env)"]
    Lang["language/\nvalidate + probe"]
    Gen["cli/generator\nDriver + SQL + Binds"]
    Tools["generated/*-tools.ts"]
    Host["core2ai MCP host\nURL-Check"]
    DB[(Database)]

    DSL --> Lang --> Gen --> Tools
    Gen --> Host
    Host --> Tools --> DB
```

| Schicht | Dateien | Was passiert |
|---------|---------|--------------|
| **DSL/Grammar** | [`db-2-ai-dsl.langium`](db2ai/packages/language/src/db-2-ai-dsl.langium) | Optional `postgres` / `mysql` / `sqlserver` im Model-Header |
| **Validierung** | [`dialect.ts`](db2ai/packages/language/src/dialect.ts), [`db-2-ai-dsl-validator.ts`](db2ai/packages/language/src/db-2-ai-dsl-validator.ts), [`sql-db-validator.ts`](db2ai/packages/language/src/sql-db-validator.ts) | URL-Prefix vs. Dialekt; **EXPLAIN/dry-run**-Probe (siehe Teil 5) — aktuell fälschlich Live-Ausführung |
| **Generator** | [`generator.ts`](db2ai/packages/cli/src/generator.ts), [`invoke-render.ts`](db2ai/packages/cli/src/generator/invoke-render.ts) | Driver-Dep (`pg` / `mysql2` / `mssql`), Placeholder-Rewrite, Invoke-Code |
| **Runtime** | [`mcp-host-product-runtime.ts`](core2ai/src/codegen/mcp-host-product-runtime.ts) | Liest `databaseDialect` aus generiertem Modul; prüft nur, dass Env-URL zum **fest eingebackenen** Dialekt passt — **kein** dynamisches Umschalten zur Laufzeit |

Der Dialekt ist damit **Compile-Time-Konfiguration pro `.db2ai`-Datei**, analog zu TypeScript-Target.

### Gibt es schon SQL Server in Docker?

**Nein.** Aktuell nur drei Services in [`docker-compose.yml`](db2ai/packages/extension/demos/docker-compose.yml):

- `pagila` — PostgreSQL (Pagila)
- `sakila` — MySQL (Sakila)
- `orders-database` — PostgreSQL (eigenes Schema)

SQL Server existiert nirgends im Repo.

---

## Entscheidungen (Plan-Iteration)

### SQL-Server-Demo-DB: Vergleich

| Option | Docker-Aufwand | Startup | Demo-Qualität | Empfehlung |
|--------|---------------|---------|---------------|------------|
| **Eigene T-SQL-DB (orders-Spiegel)** | Niedrig — wie `orders-database`: `init.sql` via Volume-Mount, kein Download | ~20 s | Ausreichend für Dialekt-/Auth-Demos | **Gewählt** |
| **Northwind** | Mittel — `.bak` (~10–50 MB) herunterladen, `RESTORE DATABASE … WITH MOVE` per Init-Script | ~60 s | Bekanntes Schema, etwas veraltet | Alternative |
| **AdventureWorksLT** | Mittel — `.bak` ~7 MB, RESTORE-Script | ~60 s | Microsoft-Standard, kompakt | Alternative |
| **AdventureWorks (voll)** | Hoch — `.bak` ~200 MB, komplexes RESTORE | ~2 min | Sehr realistisch, schwer | Nicht nötig |
| **Wide World Importers** | Hoch — `.bacpac` ~120 MB, separater `sqlpackage`-Init-Container | ~3 min | Modern/realistisch, CI-teuer | Verworfen |

**Warum nicht WWI/AdventureWorks?** Alle Microsoft-Samples brauchen entweder BACPAC-Import (extra Container, langsam) oder `.bak`-RESTORE mit `WITH MOVE`-Pfaden. Das ist deutlich aufwändiger als das bewährte [`orders-database/init.sql`](db2ai/packages/extension/demos/orders-database/init.sql)-Pattern — und für db2ai reicht ein kleines, kontrolliertes Schema zum Testen von T-SQL, Named Params und Auth.

### Named Params: nur neue Syntax (Breaking Change)

**Entscheidung:** Dual-Syntax / Legacy `$1` **entfällt** (zu aufwändig). Stattdessen einheitliche Named Params — alle Demos werden migriert.

### Live-DB-Validierung: EXPLAIN einbauen (Doc/Code-Diskrepanz)

**Ist-Zustand:** README ([`db2ai/README.md`](db2ai/README.md) Zeile 91) und core2ai-Docs ([`02-layer-2-tool-authoring.md`](core2ai/docs/02-layer-2-tool-authoring.md)) behaupten `EXPLAIN`. Der Code in [`sql-db-validator.ts`](db2ai/packages/language/src/sql-db-validator.ts) führt seit Einführung (Commit `71db7e8`) die Query **wirklich aus** — inkl. `INSERT`/`UPDATE`/`DELETE` bei jedem Speichern mit gesetzter Env-URL.

**Entscheidung:** Docs waren die Intention — **EXPLAIN/dry-run implementieren** für alle drei Dialekte. Keine Side-Effects mehr bei LSP-Validierung.

---

## Teil 1: Named Params (Breaking Change)

### Neue DSL-Syntax

```db2ai
SQL {
    toolName: listProducts
    access: public
    intent: "list products in the orders-database catalog"
    query: "SELECT product_id, name, price FROM products ORDER BY product_id LIMIT :limit"
    summary: "Product catalog rows"
    params: {
        limit: { description: "max rows" example: "50" type: integer }
    }
}
```

**Design-Entscheidungen:**

- **Param-Map-Key = MCP-Argumentname** (`limit`) — Feld `name:` entfällt aus der Grammar.
- **SQL-Platzhalter:** `:identifier` (Regex `:(\w+)`) statt `$1`.
- **Bind-Reihenfolge:** nach erstem Vorkommen im SQL-Text.
- **`optionalParams: [customerId]`** referenziert Param-Keys.

### Betroffene Dateien

| Bereich | Datei | Änderung |
|---------|-------|----------|
| Grammar | [`db-2-ai-dsl.langium`](db2ai/packages/language/src/db-2-ai-dsl.langium) | `SqlParamEntry`: `key=ID`; `PARAM_REF` + `SqlParamNameField` entfernen |
| Placeholders | [`sql-params.ts`](db2ai/packages/language/src/sql-params.ts) | `:name`-Extraktion; `rewriteNamedPlaceholders(sql, dialect)` |
| Validierung | [`db-2-ai-dsl-sql-validator.ts`](db2ai/packages/language/src/db-2-ai-dsl-sql-validator.ts) | Cross-Check `:name` ↔ params-Keys |
| Scope | [`db-2-ai-dsl-scope.ts`](db2ai/packages/language/src/db-2-ai-dsl-scope.ts) | `optionalParams` → Param-Keys |
| DB-Probe | [`sql-db-validator.ts`](db2ai/packages/language/src/sql-db-validator.ts) | Named binds + **EXPLAIN/dry-run** (Teil 5) |
| Codegen | [`db-query-codegen.ts`](db2ai/packages/cli/src/db-query-codegen.ts), [`invoke-render.ts`](db2ai/packages/cli/src/generator/invoke-render.ts) | Property-Namen aus Map-Key; Dialect-Rewrite |
| Editor | Completion + TextMate | Snippets `:limit` / `limit:` |
| Demos | `pagila.db2ai`, `sakila.db2ai`, `orders-database.db2ai` | Vollständige Migration |
| Docs | [`README.md`](db2ai/README.md) | Beispiel aktualisieren |

### Placeholder-Rewrite pro Dialekt (Codegen)

| Dialekt | DSL `:limit` | Driver-API |
|---------|-------------|------------|
| **postgres** | → `$1`, `$2`, … (positional) | `client.query({ text, values })` |
| **mysql** | → `?` | `client.query(sql, values)` |
| **sqlserver** | → `@limit`, `@offset` | `request.input('limit', …)` + `request.query(sql)` |

---

## Teil 2: SQL Server Dialekt

### DSL & Typen

- Grammar: `'sqlserver' | 'mssql'` als Aliase
- [`dialect.ts`](db2ai/packages/language/src/dialect.ts): `ResolvedDatabaseDialect = 'postgres' | 'mysql' | 'sqlserver'`
- Connection-URL: `sqlserver://` (primär) und `mssql://` (Alias) — z. B.  
  `sqlserver://sa:YourPassword@127.0.0.1:55434/orders_database?encrypt=true&trustServerCertificate=true`

### Generator / Invoke

- Dependency: [`mssql`](https://www.npmjs.com/package/mssql) (^11.x) in [`generator.ts`](db2ai/packages/cli/src/generator.ts)
- Neuer Block in [`invoke-render.ts`](db2ai/packages/cli/src/generator/invoke-render.ts): `renderSqlserverInvokeBlockTs`
  - `sql.connect(connectionString)` → Pool/Connection
  - Pro Tool: `.input(name, sqlType, value)` für jeden Named Param
  - Typ-Mapping: `integer` → `sql.Int`, `number` → `sql.Decimal`, `string` → `sql.NVarChar`, `boolean` → `sql.Bit`
- [`schema.ts`](db2ai/packages/language/src/schema.ts): optional `INFORMATION_SCHEMA`-Queries für SQL Server (niedrige Priorität, falls ungenutzt)

### core2ai Runtime

- [`mcp-host-product-runtime.ts`](core2ai/src/codegen/mcp-host-product-runtime.ts): `DatabaseDialect` um `'sqlserver'` erweitern; URL-Check für `sqlserver://` / `mssql://`
- Danach: `npm run build` in core2ai → `generate:all` + `build:generated` in db2ai

---

## Teil 3: SQL Server Test-DB in Docker (orders-Spiegel)

### Compose-Setup (4. Service, kein BACPAC)

Erweiterung von [`docker-compose.yml`](db2ai/packages/extension/demos/docker-compose.yml) — analog zu `orders-database`, aber SQL Server:

```yaml
orders-database-sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: db2ai-orders-database-sqlserver
    environment:
        ACCEPT_EULA: "Y"
        MSSQL_SA_PASSWORD: ${ORDERS_SQLSERVER_SA_PASSWORD:-YourStrong!Passw0rd}
        MSSQL_PID: Developer
    ports:
        - "${ORDERS_SQLSERVER_HOST_PORT:-55434}:1433"
    volumes:
        - ./orders-database-sqlserver/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
        test: ['CMD-SHELL', '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$$MSSQL_SA_PASSWORD" -Q "SELECT 1" -C']
        ...
    restart: unless-stopped
```

**Hinweis:** Das offizielle MSSQL-Image hat kein PostgreSQL-ähnliches `docker-entrypoint-initdb.d`. Stattdessen kleines Init-Script [`orders-database-sqlserver/entrypoint-init.sh`](db2ai/packages/extension/demos/orders-database-sqlserver/entrypoint-init.sh) oder npm-Script `db:orders-sqlserver:init`, das nach Healthcheck `init.sql` per `sqlcmd` ausführt (Pattern wie bei anderen MSSQL-Compose-Setups).

### T-SQL-Schema

Neue Datei [`orders-database-sqlserver/init.sql`](db2ai/packages/extension/demos/orders-database-sqlserver/init.sql) — logisches Spiegelbild von [`orders-database/init.sql`](db2ai/packages/extension/demos/orders-database/init.sql):

- `IDENTITY` statt `SERIAL`
- `NVARCHAR`/`DECIMAL` statt `TEXT`/`NUMERIC`
- `INSERT … OUTPUT INSERTED.*` statt `RETURNING` in Demo-Queries
- Gleiche Seed-Daten (Widget, alice, bob, …)

### npm-Scripts & Test-Support

In [`demos/package.json`](db2ai/packages/extension/demos/package.json):

- `db:orders-sqlserver:up` / Erweiterung `db:up:all`
- `db:orders-sqlserver:sqlcmd` — Shell-Helfer

Neue Dateien:

- [`orders-database-sqlserver/README.md`](db2ai/packages/extension/demos/orders-database-sqlserver/README.md) — EULA, Passwort, ARM-Hinweis
- [`test/support/orders-database-sqlserver-docker.ts`](db2ai/packages/extension/demos/test/support/orders-database-sqlserver-docker.ts) — Vitest-Fixture (~60–90 s Startup)
- [`.env.example`](db2ai/packages/extension/demos/.env.example) — `ORDERS_SQLSERVER_DATABASE_URL`, Host-Port, SA-Passwort

### Demo-DSL: `orders-database-sqlserver.db2ai`

Spiegel von `orders-database.db2ai` mit T-SQL und Named Params:

```db2ai
database sqlserver env "ORDERS_SQLSERVER_DATABASE_URL"

SQL {
    toolName: listProducts
    access: public
    intent: "list products in the orders-database catalog"
    query: '''
        SELECT TOP (:limit) product_id, name, price
        FROM products
        ORDER BY product_id
    '''
    params: {
        limit: { description: "max rows" example: "50" type: integer }
    }
}
```

Weitere Tools analog (listCustomerOrders, createOrder mit `OUTPUT INSERTED.*`, checked/protected/auth wie PostgreSQL-Demo).

Integrationstest: [`test/integration/orders-sqlserver-direct-invoke.test.ts`](db2ai/packages/extension/demos/test/integration/orders-sqlserver-direct-invoke.test.ts)

Optional: MCP-Eintrag in [`.cursor/mcp.json`](db2ai/packages/extension/demos/.cursor/mcp.json).

---

## Teil 5: EXPLAIN / Dry-Run-Validierung (Bugfix + SQL Server)

Refactoring von [`sql-db-validator.ts`](db2ai/packages/language/src/sql-db-validator.ts): `execute*Probe` → `explain*Probe`. Gemeinsame Hilfsfunktion `buildProbeSql(sql, dialect)` pro Dialekt.

| Dialekt | Methode | Verhalten |
|---------|---------|-----------|
| **postgres** | `EXPLAIN (VERBOSE) ${sql}` mit gebundenen `$n` | Plant Query, **führt nicht aus** (ohne `ANALYZE`) — gilt auch für `INSERT`/`UPDATE`/`DELETE` |
| **mysql** | `EXPLAIN ${sql}` mit `?`-Platzhaltern | Ab MySQL 8.0.18 auch für DML; plant ohne Ausführung |
| **sqlserver** | Batch: `SET NOEXEC ON; ${sql}; SET NOEXEC OFF;` mit `@param` | Kompiliert ohne Ausführung |

**Wichtig:**
- PostgreSQL: **nie** `EXPLAIN ANALYZE` (würde ausführen)
- Fehler aus Planer/Compiler → LSP-Diagnostic wie bisher
- `example`-Werte weiterhin für Bind-Validierung nötig
- Integrationstests gegen Docker-DBs: prüfen, dass nach Validierung **keine** Zeilen geändert wurden (z. B. orders `createOrder` mit festem Row-Count)

**Neue/angepasste Tests:**
- [`packages/language/test/sql-db-explain.test.ts`](db2ai/packages/language/test/sql-db-explain.test.ts) — Unit-Tests für `buildProbeSql` + Mock-Clients
- Erweiterung Live-Tests in [`sql-validating.test.ts`](db2ai/packages/language/test/sql-validating.test.ts) oder separates Integration-Test gegen Pagila/orders

**Docs:** README + core2ai-Doc bleiben bei „EXPLAIN“ — dann korrekt.

---

## Teil 6: Demo-Migration (alle `.db2ai`)

| Demo | Beispiel-Änderung |
|------|-------------------|
| **pagila** | `$1`/`$2` → `:limit`/`:offset`; `LEAST(:limit, 500)` |
| **sakila** | `CONCAT(:lastName, '%')` statt `$1` |
| **orders-database** | Restliche Tools analog zu `listProducts` (bereits begonnen) |
| **orders-database-sqlserver** (neu) | Named Params + T-SQL von Anfang an |

---

## Ablauf / Reihenfolge

```mermaid
flowchart TD
    A[1. Named Params: Grammar + sql-params + Validator]
    B[2. Codegen anpassen pg/mysql]
    E2[2b. EXPLAIN/dry-run in sql-db-validator]
    C[3. Alle Demos auf Named Params migrieren]
    D[4. SQL Server: dialect + invoke + core2ai runtime]
    E[5. Docker orders-database-sqlserver + init-T-SQL]
    F[6. orders-database-sqlserver.db2ai + Tests]
    G[7. generate:all + build:generated + npm run check]

    A --> B --> E2 --> C --> D --> E --> F --> G
```

---

## Risiken / Hinweise

- **CI-Zeit:** SQL Server Container-Start ~60–90 s (deutlich schneller als WWI-BACPAC); Vitest-Timeout analog Sakila (120 s).
- **ARM Mac:** SQL Server 2022 Linux-Image läuft unter Rosetta/emulation — in README dokumentieren.
- **Breaking Change:** `$1`-Syntax entfällt; externe `.db2ai`-Dateien müssen manuell migriert werden.
- **MSSQL Init:** Kein natives `initdb.d` — Init-Script nach Healthcheck nötig (einmalig pro Container-Lebenszyklus).
- **orders-database.db2ai** ist derzeit **out of sync** mit Generated Output (`:limit` in Source, `$1` in Generated) — wird durch diese Arbeit behoben.
