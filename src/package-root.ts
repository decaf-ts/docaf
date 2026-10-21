import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { DocsBuildError } from "./generator/diagnostics";

declare const __dirname: string | undefined;

const PACKAGE_NAME = "@decaf-ts/docaf";

function packageNameAt(directory: string): string | undefined {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, "package.json"), "utf8")
    ) as { name?: string };
    return manifest.name;
  } catch {
    return undefined;
  }
}

function walkUp(start: string): string | undefined {
  let current = path.resolve(start);
  for (;;) {
    if (packageNameAt(current) === PACKAGE_NAME) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function resolveFrom(start: string): string | undefined {
  try {
    const requireFrom = createRequire(
      path.join(path.resolve(start), "package.json")
    );
    return walkUp(path.dirname(requireFrom.resolve(PACKAGE_NAME)));
  } catch {
    return walkUp(path.resolve(start));
  }
}

/**
 * @description Locates the installed `@decaf-ts/docaf` package root at runtime.
 * @summary The helper deliberately avoids `import.meta` so the same source compiles to
 * both the ESM and CommonJS outputs. In CommonJS the module directory is
 * available directly; elsewhere the package is resolved from the current
 * project or from `DOCAF_PACKAGE_ROOT`.
 * @function resolveDocafPackageRoot
 * @param {string} [preferredStart] - Optional directory to start the upward search from.
 * @returns {string} Absolute path of the installed `@decaf-ts/docaf` package root.
 * @throws {DocsBuildError} When no package root can be located.
 * @memberOf module:docaf
 */
export function resolveDocafPackageRoot(preferredStart?: string): string {
  const configured = process.env.DOCAF_PACKAGE_ROOT;
  if (configured) {
    const resolved = walkUp(path.resolve(configured));
    if (resolved) return resolved;
  }

  if (typeof __dirname === "string") {
    const resolved = walkUp(__dirname);
    if (resolved) return resolved;
  }

  const starts = [
    preferredStart,
    process.cwd(),
    process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : undefined,
  ].filter((value): value is string => Boolean(value));

  for (const start of starts) {
    const resolved = resolveFrom(start);
    if (resolved) return resolved;
  }

  throw new DocsBuildError([
    {
      severity: "error",
      code: "DOCAF_PACKAGE_ROOT",
      message:
        "Unable to locate the @decaf-ts/docaf package root. Install @decaf-ts/docaf in the documented project, or set DOCAF_PACKAGE_ROOT to its directory.",
    },
  ]);
}
