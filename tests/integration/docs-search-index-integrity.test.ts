import fs from "node:fs";
import path from "node:path";

import { DocsDatabase } from "../../src/database/DocsDatabase";
import { DocumentationCompiler } from "../../src/generator/compiler/DocumentationCompiler";
import { DocsRuntime } from "../../src/runtime/DocsRuntime";
import type { DocsSnapshotV1 } from "../../src/snapshot";
import { DocsPageService } from "../../src/ui";
import { REPO_ROOT } from "../support/harness";

const DOCS_SNAPSHOT = path.join(REPO_ROOT, "docs/assets/docs/snapshot.json");
const SOURCE_DIRECTORY = path.join(REPO_ROOT, "src");
const PROJECT = { name: "@decaf-ts/docaf", version: "0.1.0" };

const PROBE_SYMBOLS = [
  "DocsPreviewComponent",
  "DocsPageService",
  "AngularDocsBuildTargetOptions",
  "composeSignature",
  "slugify",
  "configFingerprint",
  "searchIndex",
] as const;

function expectedSearchRecords(snapshot: DocsSnapshotV1): number {
  const searchableDoclets = snapshot.tables.doclets.filter(
    (doclet) =>
      doclet.metadata?.undocumented !== "true" && Boolean(doclet.linkId)
  );
  return searchableDoclets.length + snapshot.tables.tutorials.length;
}

async function loadSnapshot(): Promise<DocsSnapshotV1> {
  if (fs.existsSync(DOCS_SNAPSHOT))
    return JSON.parse(fs.readFileSync(DOCS_SNAPSHOT, "utf8")) as DocsSnapshotV1;
  const database = new DocsDatabase();
  const result = await new DocumentationCompiler({
    project: PROJECT,
    rootNames: [SOURCE_DIRECTORY],
    database,
    snapshot: { id: "search-index-integrity", sourceRevision: "local" },
  }).build(database);
  return result.snapshot;
}

describe("docs search index integrity", () => {
  let snapshot: DocsSnapshotV1;
  let service: DocsPageService;
  let fullIndex: Awaited<ReturnType<DocsPageService["searchIndex"]>>;

  beforeAll(async () => {
    snapshot = await loadSnapshot();
    const runtime = new DocsRuntime({ alias: "search-index-integrity" });
    const database = await runtime.bootstrap(snapshot);
    service = new DocsPageService(database);
    fullIndex = await service.searchIndex();
  }, 300000);

  it("returns one index entry per snapshot search-table record", () => {
    const records = snapshot.tables.search;

    expect(records).toHaveLength(expectedSearchRecords(snapshot));
    expect(fullIndex).toHaveLength(records.length);
    expect(fullIndex.map((entry) => entry.uid).sort()).toEqual(
      records.map((record) => record.uid).sort()
    );
  });

  it("keeps global functions, typedefs and member entries searchable", () => {
    const names = new Set(fullIndex.map((entry) => entry.name));
    for (const symbol of PROBE_SYMBOLS)
      expect(names).toContain(symbol);

    const typedefs = snapshot.tables.search.filter(
      (record) => record.kind === "typedef"
    );
    expect(typedefs.length).toBeGreaterThan(0);
    for (const typedef of typedefs) expect(names).toContain(typedef.name);
  });

  it("exposes the complete index to the client sidebar layout", async () => {
    const layout = await service.resolveLayout("/");

    expect(layout.body.sidebar.search.entries).toHaveLength(
      snapshot.tables.search.length
    );
  });

  it("honours an explicit limit without truncating the default index", async () => {
    const limited = await service.searchIndex(5);

    expect(limited).toHaveLength(5);
    expect(limited.map((entry) => entry.uid)).toEqual(
      fullIndex.slice(0, 5).map((entry) => entry.uid)
    );
    expect(await service.searchIndex(0)).toHaveLength(0);
    expect(await service.searchIndex(1000)).toHaveLength(fullIndex.length);
    expect(await service.searchIndex()).toHaveLength(fullIndex.length);
  });
});
