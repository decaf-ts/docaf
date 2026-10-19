import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DocsCliOrchestrator } from "../../src/cli/orchestrator";
import type { ResolvedDocsConfig } from "../../src/cli/types";
import {
  REPO_ROOT,
  builtEsm,
  cleanupTempDirs,
  makeTempDir,
  readJson,
  runBuiltModule,
} from "../support/harness";

interface PackageManifest {
  name?: string;
  version?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface DocsSnapshotFile {
  project: { name: string; version: string };
  tables: {
    doclets: { uid: string; name: string }[];
  };
}

function packageManifest(): PackageManifest {
  return readJson<PackageManifest>(path.join(REPO_ROOT, "package.json"));
}

function loadRepositoryConfig(): ResolvedDocsConfig {
  const result = runBuiltModule<ResolvedDocsConfig>({
    module: builtEsm("cli/config.js"),
    exportName: "loadDocsConfig",
    args: [{ cwd: REPO_ROOT }],
  });
  if (!result.ok || !result.value) {
    throw new Error(
      `loadDocsConfig failed: ${JSON.stringify(result.error ?? result)}`
    );
  }
  return result.value;
}

function dependencyNames(manifest: PackageManifest): string[] {
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ].flatMap((dependencies) => Object.keys(dependencies ?? {}));
}

function withoutDescription(manifest: PackageManifest): string {
  const clone = { ...manifest };
  delete clone.description;
  return JSON.stringify(clone).toLowerCase();
}

afterAll(() => cleanupTempDirs());

describe("docaf self-hosted docs config", () => {
  it("resolves the repository's own decafdocs.config.ts", () => {
    const config = loadRepositoryConfig();

    expect(config.root).toBe(REPO_ROOT);
    expect(config.configPath).toBe(path.join(REPO_ROOT, "decafdocs.config.ts"));
    expect(config.project.name).toBe("@decaf-ts/docaf");
    expect(config.source.tsconfigPath).toBe(path.join(REPO_ROOT, "tsconfig.json"));
    expect(config.source.include).toEqual(["src/**/*.ts"]);
    expect(config.targets).toHaveLength(1);
    expect(config.targets[0]).toMatchObject({
      renderer: "angular",
      output: path.join(REPO_ROOT, "docs"),
      routing: "hash",
      configuration: "production",
    });
  });
});

describe("docaf self-hosted source snapshot", () => {
  it(
    "snapshots the repository sources into a caller-owned directory",
    async () => {
      const config = loadRepositoryConfig();
      const directory = makeTempDir("docaf-self-hosting-snapshot-");
      const snapshotPath = path.join(directory, "snapshot.json");
      const manifestPath = path.join(directory, "build-cache.json");

      config.storage = {
        snapshotDirectory: directory,
        snapshotPath,
        manifestPath,
      } satisfies ResolvedDocsConfig["storage"];

      const summary = await new DocsCliOrchestrator(config).snapshot();

      expect(summary.mode).toBe("snapshot");
      expect(summary.cacheHit).toBe(false);
      expect(summary.project.name).toBe("@decaf-ts/docaf");
      expect(summary.counts.doclets).toBeGreaterThan(0);
      expect(summary.targets).toEqual([]);
      expect(summary.snapshotPath).toBe(snapshotPath);
      expect(fs.existsSync(snapshotPath)).toBe(true);
      expect(fs.existsSync(manifestPath)).toBe(true);

      const snapshot = readJson<DocsSnapshotFile>(snapshotPath);
      expect(snapshot.project.name).toBe("@decaf-ts/docaf");
      expect(snapshot.tables.doclets.length).toBe(summary.counts.doclets);
      expect(snapshot.tables.doclets.length).toBeGreaterThan(0);
    },
    240000
  );
});

describe("legacy documentation toolchain removal", () => {
  it("no longer declares the jsdoc devDependencies", () => {
    const manifest = packageManifest();

    expect(manifest.devDependencies).not.toHaveProperty("jsdoc");
    expect(manifest.devDependencies).not.toHaveProperty("jsdoc-mermaid");
    expect(manifest.dependencies).not.toHaveProperty("jsdoc");
    expect(manifest.dependencies).not.toHaveProperty("jsdoc-mermaid");
  });

  it("does not reference better-docs, betterdocs, or taffydb outside the factual description", () => {
    const manifest = packageManifest();
    const packageText = withoutDescription(manifest);
    const lockText = fs
      .readFileSync(path.join(REPO_ROOT, "package-lock.json"), "utf8")
      .toLowerCase();

    for (const name of ["better-docs", "betterdocs", "taffydb"]) {
      expect(dependencyNames(manifest)).not.toContain(name);
      expect(packageText).not.toContain(name);
      expect(lockText).not.toContain(name);
    }
  });

  it("does not run jsdoc, better-docs, or build-scripts --docs from npm scripts", () => {
    const manifest = packageManifest();

    for (const value of Object.values(manifest.scripts ?? {})) {
      const script = value.toLowerCase();
      expect(script).not.toContain("jsdoc");
      expect(script).not.toContain("better-docs");
      expect(script).not.toContain("build-scripts --docs");
    }
  });

  it("removes the legacy jsdoc workdocs inputs", () => {
    expect(fs.existsSync(path.join(REPO_ROOT, "workdocs/jsdocs.json"))).toBe(
      false
    );
    expect(
      fs.existsSync(path.join(REPO_ROOT, "workdocs/plugins/docaf-site-docs.cjs"))
    ).toBe(false);
  });
});

describe("self-hosted docs npm scripts", () => {
  it("builds docs through decaf docs build", () => {
    const scripts = packageManifest().scripts ?? {};

    expect(scripts.docs).toContain("decaf docs build");
    expect(scripts.docs).toContain("npm run build");
  });

  it("composes the README with markdown-include", () => {
    const scripts = packageManifest().scripts ?? {};

    expect(scripts.readme).toContain(
      "markdown-include ./workdocs/readme-md.json"
    );
  });

  it("targets the docaf container image", () => {
    const scripts = packageManifest().scripts ?? {};

    for (const name of ["docker:build", "docker:publish"]) {
      expect(scripts[name]).toContain("ghcr.io/decaf-ts/docaf");
      expect(scripts[name]).not.toContain("ts-workspace");
    }
    expect(
      Object.keys(scripts).filter((name) => /^docker:.*base/i.test(name))
    ).toEqual([]);
  });
});

describe("README composition", () => {
  it("reproduces the tracked README byte for byte from workdocs", () => {
    const directory = makeTempDir("docaf-readme-compose-");
    fs.cpSync(path.join(REPO_ROOT, "workdocs"), path.join(directory, "workdocs"), {
      recursive: true,
    });
    fs.copyFileSync(
      path.join(REPO_ROOT, "package.json"),
      path.join(directory, "package.json")
    );

    const binary = path.join(
      REPO_ROOT,
      "node_modules",
      ".bin",
      "markdown-include"
    );
    const result = spawnSync(binary, ["./workdocs/readme-md.json"], {
      cwd: directory,
      encoding: "utf8",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `markdown-include exited ${result.status}: ${result.stderr}`
      );
    }

    const generated = fs.readFileSync(
      path.join(directory, "README.md"),
      "utf8"
    );
    const tracked = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");

    expect(generated).toBe(tracked);
  });
});
