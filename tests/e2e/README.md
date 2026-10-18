# Static app end-to-end suite

`docs-angular-static-app.e2e.ts` builds the vertical-slice and native-preview
documentation apps, serves the compiled output from a throwaway static server,
and drives them with Playwright. It is separate from `test:all` because it
needs a browser and a production-like Angular build.

## Prerequisites

- Node.js 22.6+ (the suite is executed with `--experimental-strip-types`).
- `npm install` in this package (installs the `playwright` and
  `@axe-core/playwright` devDependencies).
- A Chromium build matching the installed Playwright version:

```bash
npx playwright install chromium
# On a bare Linux image that lacks shared libraries:
npx playwright install --with-deps chromium
```

Browsers are cached under `~/.cache/ms-playwright`, so the install step is
one-time per machine/Playwright version.

## Run

```bash
npm run test:e2e
```

The script runs `npm run build` first because the suite imports the compiled
`lib/esm` output. Results are written to `tmp/e2e-artifacts/e2e-results.json`;
build output stays under `tmp/e2e-angular-docs-*`.

`PLAYWRIGHT_ROOT` remains supported for environments that keep Playwright
outside this package: point it at a directory containing `package.json` and a
`playwright` install. Without it, the suite resolves the local devDependency.

## Coverage

The suite covers the TDS §18.6 flows: class/interface/component navigation,
search, browser reload/rehydration, static routing and asset URLs, preview
input updates and observed events, graceful unknown/broken previews, and the
native Angular preview. Accessibility assertions (§21.5) use
`@axe-core/playwright` against the rendered class and component pages.
