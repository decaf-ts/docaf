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

  it("exposes the documented options and descriptions", () => {
    const build = createBuildCommand();
    const snapshot = createSnapshotCommand();
    const init = createInitCommand();

    expect(build.name()).toBe("build");
    expect(build.options.map((option) => option.long)).toEqual([
      "--config",
      "--renderer",
      "--targets",
    ]);
    expect(snapshot.options.map((option) => option.long)).toEqual(["--config"]);
    expect(init.options.map((option) => option.long)).toEqual(["--config"]);
    expect(build.description()).toContain("renderer targets");
    expect(snapshot.description()).toContain("target-independent snapshot");
    expect(init.description()).toContain("default decafdocs.config.ts");
  });
});

describe("docs snapshot command", () => {
  it("runs the orchestrator and prints the operation summary", async () => {
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
  it("writes a default config at the requested path", async () => {
    const root = makeTempDir("docaf-command-init-");
    const target = path.join(root, "custom", "decafdocs.config.ts");

    const { logged, errors } = await runIn(root, () =>
      createDocsCommand().parseAsync(
        ["node", "docs", "init", "--config", target],
        { from: "node" }
      )
    );

    expect(process.exitCode).toBeUndefined();
    expect(errors).toEqual([]);
    expect(logged[0]).toBe(`created ${target}`);
    expect(logged[1]).toContain('run "decaf docs build"');
    expect(fs.existsSync(target)).toBe(true);
  });

  it("reports an existing config and sets exit code 1", async () => {
    const root = makeTempDir("docaf-command-init-exists-");
    const target = path.join(root, "decafdocs.config.ts");
    writeFile(root, "decafdocs.config.ts", "export default {};\n");

    const { errors } = await runIn(root, () =>
      createDocsCommand().parseAsync(
        ["node", "docs", "init", "--config", target],
        { from: "node" }
      )
    );

    expect(process.exitCode).toBe(1);
    expect(errors.join("\n")).toContain("DOCAF_CONFIG_EXISTS");
  });
});
