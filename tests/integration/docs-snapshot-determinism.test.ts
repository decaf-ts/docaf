import {
  DocsTables,
  exportDocsSnapshot,
  stableHash,
  stableStringify,
} from "../../src/snapshot";
import {
  FIXTURE_BUILD,
  FIXTURE_PROJECT,
  createSeededDatabase,
} from "../unit/support/fixtures";

describe("docs snapshot determinism", () => {
  it("exports byte-identical snapshots from equivalent builds", async () => {
    const [first, second] = await Promise.all([
      createSeededDatabase({ includeManifest: false }),
      createSeededDatabase({ includeManifest: false }),
    ]);

    const [firstSnapshot, secondSnapshot] = await Promise.all([
      exportDocsSnapshot(first),
      exportDocsSnapshot(second),
    ]);

    expect(stableStringify(firstSnapshot)).toBe(
      stableStringify(secondSnapshot)
    );
  });

  it("sorts every table record by uid", async () => {
    const database = await createSeededDatabase();
    const snapshot = await exportDocsSnapshot(database);

    for (const table of DocsTables) {
      const uids = snapshot.tables[table.name].map((record) => record.uid);
      expect(uids).toEqual([...uids].sort());
    }
  });

  it("computes a deterministic build id when one is not supplied", async () => {
    const database = await createSeededDatabase({ includeManifest: false });
    const snapshot = await exportDocsSnapshot(database);

    expect(snapshot.build.id).toBe(
      stableHash(stableStringify(snapshot.tables))
    );
    expect(snapshot.build.id).toMatch(/^[0-9a-f]{16}$/);
    expect(snapshot.build.sourceRevision).toBe("");
  });

  it("uses supplied project and build metadata, overriding manifest values", async () => {
    const database = await createSeededDatabase();
    const snapshot = await exportDocsSnapshot(database, {
      project: { name: "override-project", version: "9.9.9" },
      build: { id: "override-build", sourceRevision: "override-revision" },
    });

    expect(snapshot.project).toEqual({
      name: "override-project",
      version: "9.9.9",
    });
    expect(snapshot.build).toEqual({
      id: "override-build",
      sourceRevision: "override-revision",
    });
  });

  it("derives project and build metadata from the manifest when available", async () => {
    const database = await createSeededDatabase();
    const snapshot = await exportDocsSnapshot(database);

    expect(snapshot.project).toEqual({ ...FIXTURE_PROJECT });
    expect(snapshot.build).toEqual({ ...FIXTURE_BUILD });
    expect(snapshot.tables.manifests).toHaveLength(1);
  });

  it("changes the derived build id when table content changes", async () => {
    const first = await createSeededDatabase({ includeManifest: false });
    const second = await createSeededDatabase({ includeManifest: false });
    const layout = await second.layouts.read("layout:default");
    layout.title = "A different title";
    await second.layouts.update(layout);

    const [firstSnapshot, secondSnapshot] = await Promise.all([
      exportDocsSnapshot(first),
      exportDocsSnapshot(second),
    ]);

    expect(firstSnapshot.build.id).not.toBe(secondSnapshot.build.id);
  });

  it("canonicalizes object key order and hashes stably", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: 2 }, b: 1 })
    );
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableHash("docaf")).toBe(stableHash("docaf"));
    expect(stableHash("docaf")).not.toBe(stableHash("docaf1"));
    expect(stableHash("docaf")).toMatch(/^[0-9a-f]{16}$/);
  });
});
