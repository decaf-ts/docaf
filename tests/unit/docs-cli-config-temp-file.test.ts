import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  REPO_ROOT,
  cleanupTempDirs,
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
    },
    include: ["src/**/*.ts"],
  },
  null,
  2
);

const CONFIG_SOURCE =
  'export default { project: { name: "temp-file-race", version: "1.0.0" } };\n';

interface TempWrite {
  file: string;
  options: unknown;
}

interface LoadResult {
  ok: boolean;
  pid: number;
  projects?: { name: string; version: string }[];
  writes: TempWrite[];
  leftovers: string[];
  error?: {
    name?: string;
    message?: string;
    diagnostics?: { code: string; message: string }[];
  };
}

function project(prefix: string): string {
  const root = makeTempDir(prefix);
  writeFile(root, "tsconfig.json", TSCONFIG);
  writeFile(root, "decafdocs.config.ts", CONFIG_SOURCE);
  return root;
}

function loadConfigInChild(
  root: string,
  options: { concurrent?: boolean } = {}
): LoadResult {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "..", "support", "run-config-temp-race.mjs")],
    {
      cwd: REPO_ROOT,
      input: JSON.stringify({ root, concurrent: options.concurrent }),
      encoding: "utf8",
    }
  );
  if (!result.stdout) {
    throw new Error(
      `config temp-file runner produced no output (status ${result.status}): ${
        result.stderr || result.error?.message
      }`
    );
  }
  return JSON.parse(result.stdout) as LoadResult;
}

afterAll(() => cleanupTempDirs());

describe("loadDocsConfig temporary module isolation (L5)", () => {
  it("writes a per-run temp module with pid, random suffix, and exclusive create", () => {
    const root = project("docaf-config-temp-unique-");

    const result = loadConfigInChild(root);

    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.writes).toHaveLength(1);
    const [write] = result.writes;
    expect(path.basename(write.file)).toMatch(
      new RegExp(
        `^\\.decafdocs\\.config\\.[0-9a-f]{16}\\.${result.pid}\\.[0-9a-f]{8}\\.mjs$`
      )
    );
    expect(write.options).toMatchObject({
      encoding: "utf8",
      flag: "wx",
    });
    expect(result.leftovers).toEqual([]);
    expect(
      fs
        .readdirSync(root)
        .filter((entry) => entry.startsWith(".decafdocs.config."))
    ).toEqual([]);
  });

  it("gives concurrent loads distinct temp modules and leaves no residue", () => {
    const root = project("docaf-config-temp-concurrent-");

    const result = loadConfigInChild(root, { concurrent: true });

    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.projects).toEqual([
      { name: "temp-file-race", version: "1.0.0" },
      { name: "temp-file-race", version: "1.0.0" },
    ]);
    const temporaryPaths = result.writes.map((write) => write.file);
    expect(temporaryPaths).toHaveLength(2);
    expect(new Set(temporaryPaths).size).toBe(2);
    expect(result.leftovers).toEqual([]);
    expect(
      fs
        .readdirSync(root)
        .filter((entry) => entry.startsWith(".decafdocs.config."))
    ).toEqual([]);
  });
});
