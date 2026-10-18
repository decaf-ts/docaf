### How to Use

- [Initial Setup](./workdocs/tutorials/For%20Developers.md#_initial-setup_)
- [Installation](./workdocs/tutorials/For%20Developers.md#installation)
- [Scripts](./workdocs/tutorials/For%20Developers.md#scripts)
- [Linting](./workdocs/tutorials/For%20Developers.md#testing)
- [CI/CD](./workdocs/tutorials/For%20Developers.md#continuous-integrationdeployment)
- [Publishing](./workdocs/tutorials/For%20Developers.md#publishing)
- [Structure](./workdocs/tutorials/For%20Developers.md#repository-structure)
- [IDE Integrations](./workdocs/tutorials/For%20Developers.md#ide-integrations)
  - [VSCode(ium)](./workdocs/tutorials/For%20Developers.md#visual-studio-code-vscode)
  - [WebStorm](./workdocs/tutorials/For%20Developers.md#webstorm)
- [Considerations](./workdocs/tutorials/For%20Developers.md#considerations)

### Installation

Install as a regular dependency of the project whose sources you want to document (no npm-link required):

```bash
npm install @decaf-ts/docaf
```

Requirements:

- Node.js >= 20 and npm >= 10
- `@decaf-ts/cli`, which discovers `@decaf-ts/docaf` as a cli-module and exposes it as `decaf docs ...`
- a `tsconfig.json` covering the documented sources

### Documentation CLI

`decaf docs init`, `decaf docs snapshot` and `decaf docs build` extract the sources, publish the data-only documentation, write the portable snapshot and build the configured renderer targets. Flags (`--config`, `--renderer`, `--targets`), the `decafdocs.config.ts` shape, defaults, caching and `DOCAF_*` diagnostics are documented in [CLI.md](./CLI.md).

### Docker

A container image runs the same `decaf docs` CLI as a non-root user against mounted source and output folders. Image build (including the BuildKit token secret), `docker run` usage, mount and permission notes, the smoke script, and the CSP/hosting recommendation are documented in [DOCKER.md](./DOCKER.md).


