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
  tables?: { doclets?: { name: string }[] };
}

function docletNames(snapshot: Snapshot): string[] {
  return (snapshot.tables?.doclets ?? []).map((doclet) => doclet.name);
}

function makeDocsProject(prefix: string): string {
  const root = makeTempDir(prefix);
  copyFixture("vertical-slice/src", path.join(root, "src"));
  writeFile(root, "tsconfig.json", TSCONFIG);
  writeFile(
    root,
    "package.json",
    JSON.stringify({ name: "docaf-cli-fixture", version: "1.2.3" })
  );
  return root;
}

function configFilesIn(root: string): string[] {
  return fs
    .readdirSync(root)
    .filter((entry) => entry.startsWith("decafdocs.config."));
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

describe("docs without a config file", () => {
  it(
    "runs init, snapshot and build from arguments only",
    () => {
      const root = makeDocsProject("docaf-cli-no-config-");
      expect(configFilesIn(root)).toEqual([]);

      const init = runDocsCli(["init"], { cwd: root });
      expect(init.status).toBe(0);
      expect(init.stderr).toBe("");
      expect(init.stdout).toContain("docs workspace ready:");
      expect(configFilesIn(root)).toEqual([]);
      expect(fs.existsSync(path.join(root, ".decaf-docs"))).toBe(true);

      const snapshot = runDocsCli(["snapshot"], { cwd: root });
      expect(snapshot.status).toBe(0);
      expect(configFilesIn(root)).toEqual([]);
      expect(
        fs.existsSync(path.join(root, ".decaf-docs", "snapshot.json"))
      ).toBe(true);

      const build = runDocsCli(["build"], { cwd: root });
      expect(build.status).toBe(0);
      expect(configFilesIn(root)).toEqual([]);
      const output = path.join(root, "dist", "docs-angular");
      expect(fs.existsSync(path.join(output, "index.html"))).toBe(true);
      const html = fs.readFileSync(path.join(output, "index.html"), "utf8");
      expect(html).toContain('<base href="./">');
      expect(html).not.toMatch(/type\s*=\s*["']module["']/i);
    },
    300000
  );

  it("ignores a planted poisoned config file", () => {
    const root = makeDocsProject("docaf-cli-poisoned-config-");
    const marker = path.join(root, "poisoned-config-ran");
    writeFile(
      root,
      "decafdocs.config.mjs",
      `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(
        marker
      )}, "ran");\nthrow new Error("poisoned config was imported");\n`
    );
    writeFile(
      root,
      "decafdocs.config.ts",
      'throw new Error("poisoned config was imported");\n'
    );

    const run = runDocsCli(["snapshot"], { cwd: root });

    expect(run.status).toBe(0);
    expect(fs.existsSync(marker)).toBe(false);
    const snapshot = readJson<Snapshot>(
      path.join(root, ".decaf-docs", "snapshot.json")
    );
    expect(snapshot.project).toEqual({
      name: "docaf-cli-fixture",
      version: "1.2.3",
    });
    expect(configFilesIn(root)).toEqual([
      "decafdocs.config.mjs",
      "decafdocs.config.ts",
    ]);
  });
});

describe("docs snapshot", () => {
  it("writes the snapshot and cache, then reuses them on a second run", () => {
    const root = makeDocsProject("docaf-cli-snapshot-");

    const first = runDocsCli(["snapshot"], { cwd: root });
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

    const second = runDocsCli(["snapshot"], { cwd: root });
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("docs snapshot reused from cache");
    expect(fs.readFileSync(snapshotPath, "utf8")).toBe(snapshotBefore);
    expect(fs.readFileSync(manifestPath, "utf8")).toBe(manifestBefore);
  });

  it("maps explicit source, project and snapshot arguments", () => {
    const root = makeDocsProject("docaf-cli-snapshot-args-");
    writeFile(
      root,
      "tsconfig.docs.json",
      TSCONFIG.replace(
        '"include": ["src/**/*.ts"]',
        '"include": ["src/**/*.ts", "generated/**/*.ts"]'
      )
    );
    writeFile(
      root,
      "generated/extra.ts",
      "/** Generated docs fixture. */\nexport class GeneratedOnly { run(): void {} }\n"
    );

    const run = runDocsCli(
      [
        "snapshot",
        "--tsconfig",
        "./tsconfig.docs.json",
        "--include",
        "src/**/*.ts",
        "generated/**/*.ts",
        "--exclude",
        "**/*.spec.ts",
        "--project-name",
        "mapped-project",
        "--project-version",
        "9.8.7",
        "--snapshot-dir",
        "./custom-snapshots",
        "--snapshot-file",
        "docs.json",
        "--renderer",
        "angular",
        "--output",
        "./dist/site",
        "--base-href",
        "/docs/",
        "--configuration",
        "development",
      ],
      { cwd: root }
    );

    expect(run.status).toBe(0);
    expect(configFilesIn(root)).toEqual([]);
    expect(fs.existsSync(path.join(root, ".decaf-docs"))).toBe(false);

    const snapshotPath = path.join(root, "custom-snapshots", "docs.json");
    expect(fs.existsSync(snapshotPath)).toBe(true);
    expect(
      fs.existsSync(path.join(root, "custom-snapshots", "build-cache.json"))
    ).toBe(true);
    const snapshot = readJson<Snapshot>(snapshotPath);
    expect(snapshot.project).toEqual({
      name: "mapped-project",
      version: "9.8.7",
    });
    expect(docletNames(snapshot)).toContain("GeneratedOnly");

    const excluded = runDocsCli(
      [
        "snapshot",
        "--tsconfig",
        "./tsconfig.docs.json",
        "--include",
        "src/**/*.ts",
        "generated/**/*.ts",
        "--exclude",
        "**/*.spec.ts",
        "generated/**/*.ts",
        "--snapshot-dir",
        "./excluded-snapshots",
      ],
      { cwd: root }
    );
    expect(excluded.status).toBe(0);
    const withoutGenerated = readJson<Snapshot>(
      path.join(root, "excluded-snapshots", "snapshot.json")
    );
    expect(docletNames(withoutGenerated)).not.toContain("GeneratedOnly");
  });

  it(
    "emits the mapped output directory and base href in the built index",
    () => {
      const root = makeDocsProject("docaf-cli-build-args-");

      const run = runDocsCli(
        [
          "build",
          "--renderer",
          "angular",
          "--output",
          "./dist/site",
          "--base-href",
          "/docs/",
          "--configuration",
          "development",
        ],
        { cwd: root }
      );

      expect(run.status).toBe(0);
      const output = path.join(root, "dist", "site");
      const html = fs.readFileSync(path.join(output, "index.html"), "utf8");
      expect(html).toContain('<base href="/docs/">');
    },
    300000
  );
});

describe("docs build selection failures", () => {
  it("exits 1 and names an unsupported renderer", () => {
    const root = makeDocsProject("docaf-cli-renderer-");

    const run = runDocsCli(["build", "--renderer", "svelte"], { cwd: root });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("DOCAF_RENDERER_UNSUPPORTED");
    expect(run.stderr).toContain("Supported renderers: angular");
    expect(run.stderr).toContain('Unsupported docs renderer "svelte"');
  });

  it("exits 1 when --renderer and --targets are combined", () => {
    const root = makeDocsProject("docaf-cli-conflict-");

    const run = runDocsCli(
      ["build", "--renderer", "angular", "--targets", "angular"],
      { cwd: root }
    );

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("DOCAF_CLI_SELECTION_CONFLICT");
  });
});

describe("docs init", () => {
  it("prepares the snapshot directory, writes no config and is repeatable", () => {
    const root = makeDocsProject("docaf-cli-init-");

    const first = runDocsCli(["init"], { cwd: root });
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("docs workspace ready:");
    expect(first.stdout).toContain(
      path.join(root, ".decaf-docs", "snapshot.json")
    );
    expect(configFilesIn(root)).toEqual([]);
    expect(fs.existsSync(path.join(root, ".decaf-docs"))).toBe(true);

    const second = runDocsCli(["init"], { cwd: root });
    expect(second.status).toBe(0);
    expect(configFilesIn(root)).toEqual([]);
  });
});

describe("docs build target failure", () => {
  it(
    "leaves an existing output intact and removes staging directories",
    () => {
      const root = makeDocsProject("docaf-cli-target-failure-");
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

      const run = runDocsCli(["build", "--output", "./dist/docs"], {
        cwd: root,
      });

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
    },
    120000
  );
});
