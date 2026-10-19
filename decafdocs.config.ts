import { defineDocsConfig } from "@decaf-ts/docaf/cli";

/**
 * @description Documentation configuration for the `@decaf-ts/docaf` package.
 * @summary Defines how the repository self-hosts its own documentation: the
 * generator parses the TypeScript sources under `src` through the shared
 * `tsconfig.json` (excluding spec, test, and declaration files), extracts Angular components, and stores
 * doclets in a RAM adapter with a `decaf-json` v1 snapshot under
 * `.decaf-docs/`. The single rendering target builds the Angular documentation
 * application in production mode into `./docs`.
 * Executed by the `npm run docs` pipeline via the decaf CLI.
 */
export default defineDocsConfig({
  project: {
    name: "@decaf-ts/docaf",
    version: "auto",
  },
  source: {
    tsconfig: "./tsconfig.json",
    include: ["src/**/*.ts"],
    exclude: ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"],
  },
  components: {
    extractors: ["angular"],
  },
  publisher: {
    includePrivate: false,
  },
  storage: {
    adapter: "ram",
    snapshot: {
      format: "decaf-json",
      schemaVersion: 1,
    },
  },
  targets: [
    {
      renderer: "angular",
      output: "./docs",
      routing: "hash",
      baseHref: "/",
      configuration: "production",
    },
  ],
});
