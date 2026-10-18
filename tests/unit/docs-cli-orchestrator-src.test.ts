import fs from "node:fs";
import path from "node:path";
import { DocsCliOrchestrator } from "../../src/cli/orchestrator";
import type { ResolvedDocsConfig } from "../../src/cli/types";
import {
  cleanupTempDirs,
  copyFixture,
  makeTempDir,
  readJson,
  writeFile,
} from "../support/harness";

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      skipLibCheck: true,
    },
    include: ["src/**/*.ts"],
  },
  null,
  2
);

interface SnapshotManifest {
  fingerprint: string;
  schemaVersion: number;
  generatedAt: string;
  counts: Record<string, number>;
}

function docsProject(prefix: string): ResolvedDocsConfig {
  const root = makeTempDir(prefix);
  copyFixture("vertical-slice/src", path.join(root, "src"));
  writeFile(root, "tsconfig.json", TSCONFIG);
  writeFile(
    root,
    "package.json",
    JSON.stringify({ name: "orchestrator-fixture", version: "1.2.3" })
  );
  return {
    root,
    packageRoot: root,
    project: { name: "orchestrator-fixture", version: "1.2.3" },
    source: {
      tsconfigPath: path.join(root, "tsconfig.json"),
      include: ["src/**/*.ts"],
      exclude: ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"],
    },
    publisher: { includePrivate: false },
    storage: {
      snapshotDirectory: path.join(root, ".decaf-docs"),
      snapshotPath: path.join(root, ".decaf-docs", "snapshot.json"),
      manifestPath: path.join(root, ".decaf-docs", "build-cache.json"),
    },
    targets: [],
    warnings: [],
    config: {},
  };
}

function codesOf(error: unknown): string[] {
  return (
    (error as { diagnostics?: { code: string }[] }).diagnostics ?? []
  ).map((entry) => entry.code);
}

afterAll(() => cleanupTempDirs());

describe("DocsCliOrchestrator.snapshot", () => {
  it("extracts, writes the snapshot and manifest, then reuses the cache", async () => {
    const config = docsProject("docaf-orchestrator-snapshot-");
    const orchestrator = new DocsCliOrchestrator(config);

    const first = await orchestrator.snapshot();

    expect(first.mode).toBe("snapshot");
    expect(first.cacheHit).toBe(false);
    expect(first.project).toEqual(config.project);
    expect(first.snapshotPath).toBe(config.storage.snapshotPath);
    expect(first.fingerprint).toMatch(/^[0-9a-f]+$/);
    expect(first.counts.doclets).toBeGreaterThan(0);
    expect(first.targets).toEqual([]);
    expect(first.durationMs).toBeGreaterThanOrEqual(0);

    const snapshot = readJson<{ schemaVersion: number }>(
      config.storage.snapshotPath
    );
    const manifest = readJson<SnapshotManifest>(config.storage.manifestPath);
    expect(snapshot.schemaVersion).toBe(1);
    expect(manifest.fingerprint).toBe(first.fingerprint);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.counts.doclets).toBe(first.counts.doclets);
    expect(manifest.generatedAt).toEqual(expect.any(String));

    const second = await orchestrator.snapshot();
    expect(second.cacheHit).toBe(true);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("rebuilds when the cached snapshot no longer validates", async () => {
    const config = docsProject("docaf-orchestrator-invalid-cache-");
    const orchestrator = new DocsCliOrchestrator(config);
    await orchestrator.snapshot();
    fs.writeFileSync(
      config.storage.snapshotPath,
      JSON.stringify({ schemaVersion: 2 })
    );

    const rebuilt = await orchestrator.snapshot();

    expect(rebuilt.cacheHit).toBe(false);
    expect(
      readJson<{ schemaVersion: number }>(config.storage.snapshotPath)
        .schemaVersion
    ).toBe(1);
  });

  it("rebuilds when the manifest fingerprint does not match", async () => {
    const config = docsProject("docaf-orchestrator-fingerprint-");
    const orchestrator = new DocsCliOrchestrator(config);
    await orchestrator.snapshot();

    const manifest = readJson<SnapshotManifest>(config.storage.manifestPath);
    fs.writeFileSync(
      config.storage.manifestPath,
      JSON.stringify({ ...manifest, fingerprint: "stale" })
    );

    const rebuilt = await orchestrator.snapshot();

    expect(rebuilt.cacheHit).toBe(false);
  });

  it("ignores a corrupt cache manifest and rebuilds", async () => {
    const config = docsProject("docaf-orchestrator-corrupt-cache-");
    const orchestrator = new DocsCliOrchestrator(config);
    await orchestrator.snapshot();
    fs.writeFileSync(config.storage.manifestPath, "{ not json");

    const rebuilt = await orchestrator.snapshot();

    expect(rebuilt.cacheHit).toBe(false);
  });
});

describe("DocsCliOrchestrator.build", () => {
  it("rejects a build with no configured targets after preparing the snapshot", async () => {
    const config = docsProject("docaf-orchestrator-no-targets-");
    const orchestrator = new DocsCliOrchestrator(config);

    try {
      await orchestrator.build();
      throw new Error("expected build to fail");
    } catch (error) {
      expect(codesOf(error)).toEqual(["DOCAF_NO_TARGETS"]);
    }

    expect(fs.existsSync(config.storage.snapshotPath)).toBe(true);
  });

  it("rejects an unsupported requested renderer", async () => {
    const config = docsProject("docaf-orchestrator-unsupported-");
    const orchestrator = new DocsCliOrchestrator(config);

    try {
      await orchestrator.build(["svelte"]);
      throw new Error("expected build to fail");
    } catch (error) {
      expect(codesOf(error)).toEqual(["DOCAF_RENDERER_UNSUPPORTED"]);
    }
  });
});
