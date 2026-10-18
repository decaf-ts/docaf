import fs from "node:fs";
import path from "node:path";
import {
  cleanupTempDirs,
  copyFixture,
  inspectDocsCommand,
  makeTempDir,
  readJson,
  runDocsCli,
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
  counts: Record<string, number>;
}

interface Snapshot {
  schemaVersion: number;
  project: { name: string; version: string };
}

function makeDocsProject(
  prefix: string,
  targets = '[{ renderer: "angular", output: "./dist/docs" }]'
): { root: string; configPath: string } {
  const root = makeTempDir(prefix);
  copyFixture("vertical-slice/src", path.join(root, "src"));
  writeFile(root, "tsconfig.json", TSCONFIG);
  writeFile(
    root,
    "package.json",
    JSON.stringify({ name: "docaf-cli-fixture", version: "1.2.3" })
  );
  const configPath = writeFile(
    root,
    "decafdocs.config.mjs",
    `export default {
  project: { name: "docaf-cli-fixture", version: "1.2.3" },
  source: { tsconfig: "./tsconfig.json", include: ["src/**/*.ts"] },
  targets: ${targets},
};
`
  );
  return { root, configPath };
}

afterAll(() => cleanupTempDirs());

describe("docs command wiring", () => {
  it("exposes a docs command with build, snapshot and init from the built ESM module", () => {
    const shapes = inspectDocsCommand();

    for (const shape of [shapes.fromModule, shapes.direct]) {
      expect(shape.name).toBe("docs");
      expect(shape.description).toContain("documentation");
      expect(shape.commands).toEqual(["build", "snapshot", "init"]);
    }
  });
});

describe("docs snapshot", () => {
  it("writes the snapshot and cache, then reuses them on a second run", () => {
    const { root, configPath } = makeDocsProject("docaf-cli-snapshot-");

    const first = runDocsCli(["snapshot", "--config", configPath]);
    expect(first.status).toBe(0);
    expect(first.stderr).toBe("");
    expect(first.stdout).toContain("docs snapshot written");

    const snapshotPath = path.join(root, ".decaf-docs", "snapshot.json");
    const manifestPath = path.join(root, ".decaf-docs", "build-cache.json");
    expect(fs.existsSync(snapshotPath)).toBe(true);
    expect(fs.existsSync(manifestPath)).toBe(true);

    const snapshot = readJson<Snapshot>(snapshotPath);
    const manifest = readJson<SnapshotManifest>(manifestPath);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.project).toEqual({
      name: "docaf-cli-fixture",
      version: "1.2.3",
    });
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(manifest.counts.doclets).toBeGreaterThan(0);

    const snapshotBefore = fs.readFileSync(snapshotPath, "utf8");
    const manifestBefore = fs.readFileSync(manifestPath, "utf8");

    const second = runDocsCli(["snapshot", "--config", configPath]);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("docs snapshot reused from cache");
    expect(fs.readFileSync(snapshotPath, "utf8")).toBe(snapshotBefore);
    expect(fs.readFileSync(manifestPath, "utf8")).toBe(manifestBefore);
  });
});

describe("docs build selection failures", () => {
  it("exits 1 and names an unsupported renderer", () => {
    const { configPath } = makeDocsProject("docaf-cli-renderer-");

    const run = runDocsCli(["build", "--config", configPath, "--renderer", "svelte"]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("DOCAF_RENDERER_UNSUPPORTED");
    expect(run.stderr).toContain("Supported renderers: angular");
    expect(run.stderr).toContain("Configured renderers: angular");
  });

  it("exits 1 when --renderer and --targets are combined", () => {
    const { configPath } = makeDocsProject("docaf-cli-conflict-");

    const run = runDocsCli([
      "build",
      "--config",
      configPath,
      "--renderer",
      "angular",
      "--targets",
      "angular",
    ]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("DOCAF_CLI_SELECTION_CONFLICT");
  });
});

describe("docs init", () => {
  it("writes a default config and refuses to overwrite it", () => {
    const root = makeTempDir("docaf-cli-init-");
    const configPath = path.join(root, "decafdocs.config.ts");

    const first = runDocsCli(["init", "--config", configPath]);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain(`created ${configPath}`);
    expect(fs.existsSync(configPath)).toBe(true);
    const content = fs.readFileSync(configPath, "utf8");
    expect(content).toContain("export default");
    expect(content).toContain('renderer: "angular"');

    const second = runDocsCli(["init", "--config", configPath]);
    expect(second.status).toBe(1);
    expect(second.stderr).toContain("DOCAF_CONFIG_EXISTS");
    expect(fs.readFileSync(configPath, "utf8")).toBe(content);
  });
});

describe("docs build target failure", () => {
  it("leaves an existing output intact and removes staging directories", () => {
    const { root, configPath } = makeDocsProject("docaf-cli-target-failure-");
    // A project-local package missing its i18n asset makes the target fail after
    // staging is created, exercising failure cleanup without relying on a
    // missing renderer dependency.
    writeFile(
      root,
      "node_modules/@decaf-ts/for-angular/package.json",
      JSON.stringify({ name: "@decaf-ts/for-angular", version: "0.0.0" })
    );
    const output = path.join(root, "dist", "docs");
    fs.mkdirSync(output, { recursive: true });
    writeFile(output, "keep.txt", "previous output\n");

    const run = runDocsCli(["build", "--config", configPath]);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("decaf docs failed");
    expect(run.stderr).toContain("for-angular");
    expect(run.stderr).not.toContain("DOCS_ANGULAR_DEPENDENCY");
    expect(fs.existsSync(path.join(output, "keep.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(output, "keep.txt"), "utf8")).toBe(
      "previous output\n"
    );

    const siblings = fs.readdirSync(path.join(root, "dist"));
    expect(siblings).toEqual(["docs"]);
    expect(
      siblings.filter(
        (entry) =>
          entry.startsWith(".docs.staging-") ||
          entry.startsWith("docs.previous-")
      )
    ).toEqual([]);
  });
});
