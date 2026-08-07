# core2ai

> Shared runtime, code generation infrastructure, and documentation for the api2ai ecosystem.

## Ecosystem

| Repository                                            | Purpose                                                |
| ----------------------------------------------------- | ------------------------------------------------------ |
| [core2ai](https://github.com/annettedorothea/core2ai) | Shared runtime, architecture, and documentation        |
| [api2ai](https://github.com/annettedorothea/api2ai)   | Generate curated MCP tools from OpenAPI specifications |
| [db2ai](https://github.com/annettedorothea/db2ai)     | Generate curated MCP tools from relational databases   |

`core2ai` provides the common foundation used by the other projects in the ecosystem.

It contains the shared infrastructure for:

- code generation
- validation
- MCP host generation
- authentication bootstrap
- runtime components
- architecture and documentation

If you want to generate MCP tools, you will usually start with one of the sibling projects instead.

---

## Documentation

[Documentation index](docs/README.md) — architecture, authoring, runtime, and integrations.

[Videos](docs/videos.md) — [Willkommen bei Tool Factory](https://www.youtube.com/watch?v=KYaKTWkooeU) (DE) and more.

---

## Related Projects

- [api2ai](https://github.com/annettedorothea/api2ai) — Generate curated MCP tools from OpenAPI specifications.
- [db2ai](https://github.com/annettedorothea/db2ai) — Generate curated MCP tools from relational databases.

---

## Development

`core2ai` is currently consumed as a local dependency by `api2ai` and `db2ai` and is not published to npm.

Install dependencies:

```bash
npm install
```

Whenever you make changes, rebuild the package so the dependent repositories can pick up the latest version:

```bash
npm run build
```

Although a watch mode exists, rebuilding after changes is currently the recommended workflow.

---

## Feedback

We welcome feedback on onboarding, documentation, DSL ergonomics, and MCP integration across the ecosystem. Share your experience in [GitHub Discussions](https://github.com/annettedorothea/core2ai/discussions/1). For bugs, open an [Issue](https://github.com/annettedorothea/core2ai/issues).

Product-specific feedback is also welcome in [api2ai Discussions](https://github.com/annettedorothea/api2ai/discussions/3) and [db2ai Discussions](https://github.com/annettedorothea/db2ai/discussions/1).

---

## License

MIT — see [LICENSE](LICENSE).

---

> _Whatever you do, work heartily, as for the Lord and not for men._
>
> **— Colossians 3:23**
>
> _Created by Annette Pohl_
