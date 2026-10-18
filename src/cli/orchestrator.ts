import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { DocsBuildContext } from "../build/DocsBuildTarget";
import { DocsDatabase } from "../database/DocsDatabase";
import { DocumentationCompiler } from "../generator/compiler/DocumentationCompiler";
import { DocsBuildError } from "../generator/diagnostics";
import {
  DocsTableNames,
  stableHash,
  validateDocsSnapshot,
  type DocsSnapshotV1,
} from "../snapshot";
import { resolveDocsInputs } from "./inputs";
import { createBuildTarget, selectTargets, supportedRenderers } from "./targets";
import type {
  DocsOperationSummary,
  DocsTargetSummary,
  ResolvedDocsConfig,
  ResolvedDocsTarget,
} from "./types";

interface PreparedSnapshot {
  snapshot: DocsSnapshotV1;
  cacheHit: boolean;
  fingerprint: string;
  warnings: string[];
}

function countsOf(snapshot: DocsSnapshotV1): Record<string, number> {
  return Object.fromEntries(
    DocsTableNames.map((table) => [
      table,
      Array.isArray(snapshot.tables[table]) ? snapshot.tables[table].length : 0,
    ])
  );
}

async function writeJsonAtomic(
  filePath: string,
  value: unknown
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

async function readCachedSnapshot(
  config: ResolvedDocsConfig,
  fingerprint: string
): Promise<DocsSnapshotV1 | undefined> {
  try {
    const manifest = JSON.parse(
      await fs.readFile(config.storage.manifestPath, "utf8")
    ) as { fingerprint?: string; schemaVersion?: number };
    if (manifest.fingerprint !== fingerprint) return undefined;
    const snapshot = JSON.parse(
      await fs.readFile(config.storage.snapshotPath, "utf8")
    ) as DocsSnapshotV1;
    validateDocsSnapshot(snapshot);
    return snapshot;
  } catch {
    return undefined;
  }
}

async function publishStaging(
  staging: string,
  output: string
): Promise<void> {
  const backup = `${output}.previous-${process.pid}`;
  await fs.rm(backup, { recursive: true, force: true });
  const hadOutput = existsSync(output);
  if (hadOutput) await fs.rename(output, backup);
  try {
    await fs.rename(staging, output);
  } catch (error) {
    if (hadOutput) await fs.rename(backup, output).catch(() => undefined);
    throw error;
  }
  if (hadOutput) await fs.rm(backup, { recursive: true, force: true });
}

/**
 * Orchestrates the TDS §13.4 pipeline: extract once, publish once, snapshot
 * once, then compile each selected target in an isolated staging directory and
 * publish it atomically. A failed target never touches an existing output and
 * never mutates the shared snapshot.
 */
export class DocsCliOrchestrator {
  private readonly config: ResolvedDocsConfig;

  constructor(config: ResolvedDocsConfig) {
    this.config = config;
  }

  async snapshot(): Promise<DocsOperationSummary> {
    const started = Date.now();
    const prepared = await this.prepareSnapshot();
    return this.summary("snapshot", started, prepared, []);
  }

  async build(
    requestedRenderers?: readonly string[]
  ): Promise<DocsOperationSummary> {
    const started = Date.now();
    const prepared = await this.prepareSnapshot();
    const targets = selectTargets(this.config, requestedRenderers);
    if (!targets.length) {
      throw new DocsBuildError([
        {
          severity: "error",
          code: "DOCAF_NO_TARGETS",
          message: `No docs targets selected. Supported renderers: ${supportedRenderers().join(
            ", "
          )}.`,
        },
      ]);
    }

    const snapshotBefore = stableHash(
      await fs.readFile(this.config.storage.snapshotPath, "utf8")
    );
    const summaries: DocsTargetSummary[] = [];
    for (const target of targets) {
      summaries.push(await this.runTarget(target));
    }
    const snapshotAfter = stableHash(
      await fs.readFile(this.config.storage.snapshotPath, "utf8")
    );
    if (snapshotBefore !== snapshotAfter) {
      throw new DocsBuildError([
        {
          severity: "error",
          code: "DOCAF_SNAPSHOT_MUTATED",
          message:
            "A target build modified the shared docs snapshot. Targets must read the snapshot produced by extraction/publication and never rewrite it (REN-08).",
        },
      ]);
    }

    return this.summary("build", started, prepared, summaries);
  }

  private async prepareSnapshot(): Promise<PreparedSnapshot> {
    const inputs = resolveDocsInputs(this.config);
    const cached = await readCachedSnapshot(this.config, inputs.fingerprint);
    if (cached) {
      return {
        snapshot: cached,
        cacheHit: true,
        fingerprint: inputs.fingerprint,
        warnings: [],
      };
    }

    const database = new DocsDatabase();
    const compiler = new DocumentationCompiler({
      project: this.config.project,
      rootNames: inputs.files.map((file) => file.absolute),
      compilerOptions: inputs.compilerOptions,
      database,
      publisher: {
        includePrivate: this.config.publisher.includePrivate,
      },
      snapshot: {
        id: `docs-${inputs.fingerprint}`,
        sourceRevision: inputs.fingerprint,
      },
    });
    const result = await compiler.build(database);
    const snapshot = result.snapshot;

    await writeJsonAtomic(this.config.storage.snapshotPath, snapshot);
    await writeJsonAtomic(this.config.storage.manifestPath, {
      fingerprint: inputs.fingerprint,
      schemaVersion: snapshot.schemaVersion,
      generatedAt: new Date().toISOString(),
      project: snapshot.project,
      snapshot: path.basename(this.config.storage.snapshotPath),
      counts: countsOf(snapshot),
    });

    return {
      snapshot,
      cacheHit: false,
      fingerprint: inputs.fingerprint,
      warnings: result.extraction.diagnostics.warnings.map(
        (diagnostic) => `${diagnostic.code}: ${diagnostic.message}`
      ),
    };
  }

  private async runTarget(
    target: ResolvedDocsTarget
  ): Promise<DocsTargetSummary> {
    const buildTarget = createBuildTarget(target, {
      packageRoot: this.config.packageRoot,
      configuration: target.configuration,
    });
    const output = target.output;
    const staging = path.join(
      path.dirname(output),
      `.${path.basename(output)}.staging-${process.pid}-${buildTarget.id}`
    );
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.rm(staging, { recursive: true, force: true });

    const context: DocsBuildContext = {
      projectRoot: this.config.root,
      outputDirectory: staging,
      snapshotPath: this.config.storage.snapshotPath,
      config: {
        project: this.config.project,
        components: { extractors: ["angular"] },
        publisher: this.config.publisher,
        output: { directory: output, baseHref: target.baseHref },
      },
      components: [],
      previews: [],
      layouts: [],
    };

    try {
      await buildTarget.validate(context);
      await buildTarget.prepare(context);
      const result = await buildTarget.build(context);
      await publishStaging(staging, output);
      return {
        renderer: target.renderer,
        output,
        files: result.files,
        durationMs: result.durationMs,
        warnings: result.warnings,
      };
    } catch (error) {
      await fs.rm(staging, { recursive: true, force: true });
      throw error;
    }
  }

  private summary(
    mode: "build" | "snapshot",
    started: number,
    prepared: PreparedSnapshot,
    targets: DocsTargetSummary[]
  ): DocsOperationSummary {
    return {
      mode,
      project: this.config.project,
      snapshotPath: this.config.storage.snapshotPath,
      cacheHit: prepared.cacheHit,
      fingerprint: prepared.fingerprint,
      counts: countsOf(prepared.snapshot),
      targets,
      warnings: prepared.warnings,
      durationMs: Date.now() - started,
      snapshot: prepared.snapshot,
    };
  }
}
