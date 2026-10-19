## Contributing

[fork]: https://github.com/decaf-ts/docaf/fork
[pr]: https://github.com/decaf-ts/docaf/compare
[developers-guide]: ./For%20Developers.md

Contributions are welcome. By submitting a pull request you agree that your contribution is
released under the [project's MIT license](../../LICENSE.md).

### Before you start

- Search the [existing issues](https://github.com/decaf-ts/docaf/issues) and pull requests.
- For a bug, include a minimal reproduction: the input TypeScript and JSDoc, the configuration,
  and the command you ran.
- For a feature, describe the use case and how it fits the snapshot/publisher pipeline. Changes to
  the generated doclet shape or the CLI contract need a compatibility note.
- Keep changes focused. Unrelated refactors belong in a separate pull request.

### Bootstrapping

```bash
git clone https://github.com/<your-user>/docaf.git
cd docaf
npm ci
npm run build
```

Node.js >= 20 and npm >= 10 are required. The full toolchain, repository layout, and scripts are
described in the [developer guide][developers-guide].

### Making a change

1. Create a branch from `master` with a descriptive name.
2. Make the change. Add or update tests under `tests/unit` or `tests/integration` when behavior
   changes.
3. If you touched JSDoc comments, follow [Documentation](./Documentation.md). If you touched
   `workdocs/`, regenerate `README.md` with `npm run readme`; never edit `README.md` directly.
4. Run the local gates:

   ```bash
   npm run lint
   npm run test:all
   npm run build
   ```

   For renderer or end-to-end changes, also run `npm run test:e2e` after
   `npx playwright install chromium`. For type-converter changes, run `npm run test:parity`, and
   regenerate the baseline only if the change is an intentional, reviewed divergence.

5. Refresh the docs when the public surface or workflows changed:

   ```bash
   npm run docs
   ```

6. Push your branch and open a [pull request][pr]. Fill in what changed, why, how it was verified,
   and any compatibility impact. Link the issue it addresses.

### Review and merge

- CI must be green: build, tests, coverage, CodeQL, and the dependency/security scans.
- A maintainer reviews for correctness, test coverage, documentation impact, and public API
  compatibility.
- Squash or rebase as requested; keep the commit message descriptive and free of generated
  artifacts.
- Merging to `master` starts the automated release cycle: the shared release workflow bumps the
  version, tags the commit, runs the release gates, and publishes the package. Do not tag or
  publish manually unless a maintainer asks you to.

### Reporting security issues

Do not open a public issue for a vulnerability. Follow the repository's security policy or
contact the maintainers privately so a fix can be prepared before disclosure.

### Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
