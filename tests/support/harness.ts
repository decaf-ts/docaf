import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "../..");

export interface HarnessDiagnostic {
  code: string;
  message: string;
}

export interface HarnessError {
  name?: string;
  message?: string;
  code?: string;
  diagnostics?: HarnessDiagnostic[];
}

export interface HarnessResult<T> {
  ok: boolean;
  value?: T;
  error?: HarnessError;
}

export interface CliRunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function builtEsm(relative: string): string {
  return path.join(REPO_ROOT, "lib", "esm", relative);
}

export function runBuiltModule<T>(request: {
  module: string;
  exportName: string;
  args?: unknown[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): HarnessResult<T> {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "run-built-module.mjs")],
    {
      cwd: request.cwd ?? REPO_ROOT,
      input: JSON.stringify(request),
      encoding: "utf8",
      env: { ...process.env, ...request.env },
    }
  );
  if (!result.stdout) {
    throw new Error(
      `Built-module harness produced no output (status ${result.status}): ${
        result.stderr || result.error?.message
      }`
    );
  }
  return JSON.parse(result.stdout) as HarnessResult<T>;
}

export function runDocsCli(
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): CliRunResult {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "run-docs-cli.mjs")],
    {
      cwd: options.cwd ?? REPO_ROOT,
      input: JSON.stringify({ op: "run", args }),
      encoding: "utf8",
      env: { ...process.env, ...options.env },
    }
  );
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export interface CommandShape {
  name: string;
  description: string;
  commands: string[];
}

export function inspectDocsCommand(): {
  fromModule: CommandShape;
  direct: CommandShape;
} {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "run-docs-cli.mjs")],
    {
      cwd: REPO_ROOT,
      input: JSON.stringify({ op: "inspect" }),
      encoding: "utf8",
      env: { ...process.env },
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0 || !result.stdout) {
    throw new Error(
      `Command inspection failed (status ${result.status}): ${result.stderr}`
    );
  }
  return JSON.parse(result.stdout);
}

const temporaryDirectories: string[] = [];

export function makeTempDir(prefix = "docaf-test-"): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

export function cleanupTempDirs(): void {
  while (temporaryDirectories.length) {
    const directory = temporaryDirectories.pop() as string;
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

export function writeFile(
  root: string,
  relative: string,
  content: string
): string {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  return file;
}

export function copyFixture(relative: string, destination: string): void {
  fs.cpSync(path.join(REPO_ROOT, "tests", "fixtures", relative), destination, {
    recursive: true,
  });
}

export function readJson<T = unknown>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function listDirectory(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory);
}
