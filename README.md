# core2ai

Shared runtime and code generation infrastructure for **api2ai** and **db2ai**.

core2ai contains the common building blocks used by both projects, including:

- code generation
- validation
- MCP host generation
- authentication bootstrap
- shared runtime components

Most users should start with one of the sibling projects:

- **api2ai** — Turn any OpenAPI specification into AI-ready tools.
- **db2ai** — Turn your database into AI-ready tools.

---

## Architecture

The architecture and mental model are documented here:

📖 `docs/README.md`

Topics include:

- Tool Factory
- Tool Authoring
- AI Runtime
- Personas

---

## Development

core2ai is currently used as a local dependency by api2ai and db2ai and is not published to npm.

For active development:

```bash
npm install
npm run build
npm run watch
```

---

## License

MIT — see [LICENSE](./LICENSE).

Integration, consulting, and support: open a [GitHub Discussion](https://github.com/annettedorothea/core2ai/discussions) or issue.

---

#Col3:23
