import fs from "node:fs";
import path from "node:path";
import docsModule from "../../src/cli-module";
import { createDocsCommand } from "../../src/cli/command";
import { resolveDocafPackageRoot } from "../../src/package-root";
import {
  REPO_ROOT,
  cleanupTempDirs,
  makeTempDir,
  writeFile,
} from "../support/harness";

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

describe("resolveDocafPackageRoot (source)", () => {
  it("resolves the package root from the source module directory", () => {
    expect(resolveDocafPackageRoot()).toBe(REPO_ROOT);
    expect(resolveDocafPackageRoot(path.join(REPO_ROOT, "src", "cli"))).toBe(
      REPO_ROOT
    );
  });

  it("prefers a DOCAF_PACKAGE_ROOT that belongs to the package", () => {
    const nested = path.join(REPO_ROOT, "src", "generator");

    expect(
      withEnv("DOCAF_PACKAGE_ROOT", nested, () =>
        resolveDocafPackageRoot(path.join(REPO_ROOT, "src"))
      )
    ).toBe(REPO_ROOT);
  });

  it("ignores a DOCAF_PACKAGE_ROOT outside the package", () => {
    const outside = makeTempDir("docaf-package-root-outside-");
    writeFile(outside, "package.json", JSON.stringify({ name: "other" }));

    expect(
      withEnv("DOCAF_PACKAGE_ROOT", outside, () => resolveDocafPackageRoot())
    ).toBe(REPO_ROOT);
  });

  it("finds the package through the preferred start when walking up", () => {
    expect(
      resolveDocafPackageRoot(path.join(REPO_ROOT, "tests", "unit"))
    ).toBe(REPO_ROOT);
  });

  it("keeps the package root stable regardless of the current directory", () => {
    const previous = process.cwd();
    const outside = makeTempDir("docaf-package-root-cwd-");
    writeFile(
      outside,
      "package.json",
      JSON.stringify({ name: "@decaf-ts/docaf", version: "0.0.0" })
    );
    process.chdir(outside);
    try {
      expect(resolveDocafPackageRoot()).toBe(REPO_ROOT);
    } finally {
      process.chdir(previous);
    }
  });

  it("does not treat an unrelated package manifest as the docaf root", () => {
    const outside = makeTempDir("docaf-package-root-other-");
    writeFile(outside, "package.json", JSON.stringify({ name: "unrelated" }));
    expect(fs.existsSync(path.join(outside, "package.json"))).toBe(true);
    expect(
      withEnv("DOCAF_PACKAGE_ROOT", outside, () => resolveDocafPackageRoot())
    ).toBe(REPO_ROOT);
  });
});

describe("cli-module entry point", () => {
  it("returns the docs command tree", () => {
    const command = docsModule();

    expect(command.name()).toBe("docs");
    expect(command.commands.map((entry) => entry.name())).toEqual([
      "build",
      "snapshot",
      "init",
    ]);
  });

  it("matches the command built directly from the command module", () => {
    const direct = createDocsCommand();
    const module = docsModule();

    expect(module.description()).toBe(direct.description());
    expect(module.commands.map((entry) => entry.name())).toEqual(
      direct.commands.map((entry) => entry.name())
    );
  });
});
