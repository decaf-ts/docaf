import fs from "node:fs";
import path from "node:path";
import {
  createBuildCommand,
  createDocsCommand,
  createInitCommand,
  createSnapshotCommand,
} from "../../src/cli/command";
import {
  cleanupTempDirs,
  copyFixture,
  makeTempDir,
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

const SOURCE_OPTIONS = [
  "--tsconfig",
  "--include",
  "--exclude",
  "--project-name",
  "--project-version",
  "--include-private",
  "--snapshot-dir",
  "--snapshot-file",
  "--plugins",
  "--extractors",
  "--theme",
  "--layout",
];

const TARGET_OPTIONS = [
  "--renderer",
  "--output",
  "--base-href",
  "--configuration",
  "--routing",
];

function docsProject(prefix: string): string {
  const root = makeTempDir(prefix);
  copyFixture("vertical-slice/src", path.join(root, "src"));
  writeFile(root, "tsconfig.json", TSCONFIG);
  writeFile(
    root,
    "package.json",
    JSON.stringify({ name: "command-fixture", version: "0.4.0" })
  );
  return root;
}

function configFilesIn(root: string): string[] {
  return fs
    .readdirSync(root)
    .filter((entry) => entry.startsWith("decafdocs.config."));
}

async function runIn<T>(
  cwd: string,
  action: () => Promise<T>
): Promise<{ result: T; logged: string[]; errors: string[] }> {
  const previous = process.cwd();
  const logged: string[] = [];
  const errors: string[] = [];
  const log = jest
    .spyOn(console, "log")
    .mockImplementation((...args: unknown[]) => {
      logged.push(args.join(" "));
    });
  const warn = jest
    .spyOn(console, "warn")
    .mockImplementation((...args: unknown[]) => {
      logged.push(args.join(" "));
    });
  const error = jest
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });
  process.chdir(cwd);
  try {
    const result = await action();
    return { result, logged, errors };
  } finally {
    process.chdir(previous);
    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  }
}

afterEach(() => {
  process.exitCode = undefined;
});

afterAll(() => cleanupTempDirs());

describe("docs command shape", () => {
  it("registers build, snapshot and init subcommands", () => {
    const docs = createDocsCommand();

    expect(docs.name()).toBe("docs");
    expect(docs.description()).toContain("documentation");
    expect(docs.commands.map((command) => command.name())).toEqual([
      "build",
      "snapshot",
      "init",
    ]);
  });

  it("exposes the documented arguments-only options", () => {
    const build = createBuildCommand();
    const snapshot = createSnapshotCommand();
    const init = createInitCommand();

    expect(build.name()).toBe("build");
    expect(build.options.map((option) => option.long)).toEqual([
      ...SOURCE_OPTIONS,
      ...TARGET_OPTIONS,
      "--targets",
    ]);
    expect(snapshot.options.map((option) => option.long)).toEqual([
      ...SOURCE_OPTIONS,
      ...TARGET_OPTIONS,
    ]);
    expect(init.options.map((option) => option.long)).toEqual([
      ...SOURCE_OPTIONS,
      ...TARGET_OPTIONS,
    ]);
    expect(build.description()).toContain("renderer targets");
    expect(snapshot.description()).toContain("target-independent snapshot");
    expect(init.description()).toContain("no config file");
    expect(
      [...build.options, ...snapshot.options, ...init.options].map(
        (option) => option.long
      )
    ).not.toContain("--config");
  });
});

describe("docs snapshot command", () => {
  it("runs the orchestrator from arguments only and prints the summary", async () => {
    const root = docsProject("docaf-command-snapshot-");

    const { logged, errors } = await runIn(root, () =>
      createDocsCommand().parseAsync(["node", "docs", "snapshot"], {
        from: "node",
      })
    );

    expect(process.exitCode).toBeUndefined();
    expect(errors).toEqual([]);
    expect(logged.join("\n")).toContain("docs snapshot written:");
    expect(logged.join("\n")).toContain("command-fixture@0.4.0");
    expect(fs.existsSync(path.join(root, ".decaf-docs", "snapshot.json"))).toBe(
      true
    );
    expect(configFilesIn(root)).toEqual([]);
  });

  it("reports failures as diagnostics and sets exit code 1", async () => {
    const root = makeTempDir("docaf-command-failure-");

    const { errors } = await runIn(root, () =>
      createDocsCommand().parseAsync(["node", "docs", "snapshot"], {
        from: "node",
      })
    );

    expect(process.exitCode).toBe(1);
    expect(errors.join("\n")).toContain("decaf docs failed:");
    expect(errors.join("\n")).toContain("DOCAF_CONFIG_TSCONFIG_MISSING");
  });
});

describe("docs init command", () => {
  it("prepares the snapshot directory and writes no config file", async () => {
    const root = docsProject("docaf-command-init-");

    const { logged, errors } = await runIn(root, () =>
      createDocsCommand().parseAsync(["node", "docs", "init"], {
        from: "node",
      })
    );

    expect(process.exitCode).toBeUndefined();
    expect(errors).toEqual([]);
    expect(logged.join("\n")).toContain("docs workspace ready:");
    expect(logged.join("\n")).toContain("source: 3 file(s) via");
    expect(logged.join("\n")).toContain(
      `snapshot: ${path.join(root, ".decaf-docs", "snapshot.json")}`
    );
    expect(logged.join("\n")).toContain("next: decaf docs build");
    expect(configFilesIn(root)).toEqual([]);
    expect(fs.existsSync(path.join(root, ".decaf-docs"))).toBe(true);
  });

  it("uses explicit argument paths for validation and snapshot preparation", async () => {
    const root = docsProject("docaf-command-init-args-");
    writeFile(
      root,
      "tsconfig.docs.json",
      TSCONFIG.replace('"src/**/*.ts"', '"src/**/*.ts", "generated/**/*.ts"')
    );

    const { logged, errors } = await runIn(root, () =>
      createDocsCommand().parseAsync(
        [
          "node",
          "docs",
          "init",
          "--tsconfig",
          "./tsconfig.docs.json",
          "--include",
          "src/**/*.ts",
          "--snapshot-dir",
          "./custom-snapshots",
          "--snapshot-file",
          "docs.json",
          "--project-name",
          "argument-project",
          "--base-href",
          "/docs/",
          "--layout",
          "page:DocPageLayout",
        ],
        { from: "node" }
      )
    );

    expect(process.exitCode).toBeUndefined();
    expect(errors).toEqual([]);
    expect(logged.join("\n")).toContain(
      `snapshot: ${path.join(root, "custom-snapshots", "docs.json")}`
    );
    expect(logged.join("\n")).toContain("--base-href /docs/");
    expect(logged.join("\n")).toContain("--layout");
    expect(fs.existsSync(path.join(root, "custom-snapshots"))).toBe(true);
    expect(configFilesIn(root)).toEqual([]);
  });

  it("passes --layout through as a compatibility warning", async () => {
    const root = docsProject("docaf-command-init-layout-");

    const { logged, errors } = await runIn(root, () =>
      createDocsCommand().parseAsync(
        [
          "node",
          "docs",
          "init",
          "--layout",
          "page:DocPageLayout",
          "tutorial:TutorialLayout",
        ],
        { from: "node" }
      )
    );

    expect(process.exitCode).toBeUndefined();
    expect(errors).toEqual([]);
    expect(logged.join("\n")).toContain("--layout");
  });

  it("ignores a planted config file", async () => {
    const root = docsProject("docaf-command-init-poisoned-");
    const marker = path.join(root, "poisoned-config-ran");
    writeFile(
      root,
      "decafdocs.config.mjs",
      `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(
        marker
      )}, "ran");\nthrow new Error("poisoned config was imported");\n`
    );

    const { logged, errors } = await runIn(root, () =>
      createDocsCommand().parseAsync(["node", "docs", "init"], {
        from: "node",
      })
    );

    expect(process.exitCode).toBeUndefined();
    expect(errors).toEqual([]);
    expect(fs.existsSync(marker)).toBe(false);
    expect(logged.join("\n")).toContain("docs workspace ready:");
    expect(configFilesIn(root)).toEqual(["decafdocs.config.mjs"]);
  });

  it("validates the tsconfig before creating the snapshot directory", async () => {
    const root = makeTempDir("docaf-command-init-validation-");

    const { errors } = await runIn(root, () =>
      createDocsCommand().parseAsync(["node", "docs", "init"], {
        from: "node",
      })
    );

    expect(process.exitCode).toBe(1);
    expect(errors.join("\n")).toContain("DOCAF_CONFIG_TSCONFIG_MISSING");
    expect(fs.existsSync(path.join(root, ".decaf-docs"))).toBe(false);
    expect(configFilesIn(root)).toEqual([]);
  });
});
