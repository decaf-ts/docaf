import path from "node:path";
import { createRequire } from "node:module";
import {
  REPO_ROOT,
  builtEsm,
  cleanupTempDirs,
  makeTempDir,
  runBuiltModule,
} from "../support/harness";

const requireCjs = createRequire(__filename);
const { resolveDocafPackageRoot: resolveFromCjs } = requireCjs(
  "../../lib/cjs/package-root.cjs"
) as typeof import("../../src/package-root");

function withEnv<T>(name: string, value: string | undefined, action: () => T): T {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return action();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

afterAll(() => cleanupTempDirs());

describe("resolveDocafPackageRoot", () => {
  it("resolves the package root from the CommonJS build", () => {
    expect(resolveFromCjs()).toBe(REPO_ROOT);
    expect(resolveFromCjs(path.join(REPO_ROOT, "src", "cli"))).toBe(REPO_ROOT);
  });

  it("resolves the package root from the ESM build", () => {
    const fromNested = runBuiltModule<string>({
      module: builtEsm("package-root.js"),
      exportName: "resolveDocafPackageRoot",
      args: [path.join(REPO_ROOT, "src", "cli")],
    });
    expect(fromNested.ok).toBe(true);
    expect(fromNested.value).toBe(REPO_ROOT);

    const fromCwd = runBuiltModule<string>({
      module: builtEsm("package-root.js"),
      exportName: "resolveDocafPackageRoot",
      args: [],
      cwd: REPO_ROOT,
    });
    expect(fromCwd.ok).toBe(true);
    expect(fromCwd.value).toBe(REPO_ROOT);
  });

  it("honours the DOCAF_PACKAGE_ROOT override", () => {
    const nested = path.join(REPO_ROOT, "src", "generator");

    expect(
      withEnv("DOCAF_PACKAGE_ROOT", nested, () =>
        resolveFromCjs(path.join(REPO_ROOT, "src"))
      )
    ).toBe(REPO_ROOT);

    const esm = runBuiltModule<string>({
      module: builtEsm("package-root.js"),
      exportName: "resolveDocafPackageRoot",
      args: [],
      cwd: makeTempDir("docaf-package-root-"),
      env: { DOCAF_PACKAGE_ROOT: path.join(REPO_ROOT, "src", "cli") },
    });
    expect(esm.ok).toBe(true);
    expect(esm.value).toBe(REPO_ROOT);
  });
});
