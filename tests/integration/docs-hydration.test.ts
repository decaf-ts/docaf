import { DocsDatabase } from "../../src/database/DocsDatabase";
import { DocLayoutModel } from "../../src/models";
import {
  DocsTables,
  exportDocsSnapshot,
  hydrateDocsDatabase,
  stableStringify,
} from "../../src/snapshot";
import {
  createSeededDatabase,
  exportFixtureSnapshot,
} from "../unit/support/fixtures";

async function tableCounts(
  database: DocsDatabase
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    DocsTables.map(async (table) => [
      table.name,
      (
        await database.repositories()[table.name].select().execute()
      ).length,
    ])
  );
  return Object.fromEntries(entries);
}

describe("hydrateDocsDatabase", () => {
  it("recreates equivalent logical records in a fresh database", async () => {
    const snapshot = await exportFixtureSnapshot();
    const target = new DocsDatabase();
    await target.initialize();

    await hydrateDocsDatabase(target, snapshot);
    const reexported = await exportDocsSnapshot(target);

    expect(stableStringify(reexported)).toBe(stableStringify(snapshot));
    for (const table of DocsTables) {
      const expected = snapshot.tables[table.name].map((record) =>
        table.codec.encode(table.codec.decode(record))
      );
      const actual = reexported.tables[table.name].map((record) =>
        table.codec.encode(table.codec.decode(record))
      );
      expect(actual).toEqual(expected);
    }
  });

  it("does not duplicate records when hydrated repeatedly", async () => {
    const snapshot = await exportFixtureSnapshot();
    const target = new DocsDatabase();
    await target.initialize();

    await hydrateDocsDatabase(target, snapshot);
    const firstCounts = await tableCounts(target);
    const firstExport = await exportDocsSnapshot(target);

    await hydrateDocsDatabase(target, snapshot);
    const secondCounts = await tableCounts(target);
    const secondExport = await exportDocsSnapshot(target);

    expect(secondCounts).toEqual(firstCounts);
    expect(stableStringify(secondExport)).toBe(stableStringify(firstExport));
  });

  it("updates changed records instead of creating duplicates", async () => {
    const snapshot = await exportFixtureSnapshot();
    const target = new DocsDatabase();
    await target.initialize();
    await hydrateDocsDatabase(target, snapshot);
    const before = await tableCounts(target);

    const changed = await exportFixtureSnapshot();
    changed.tables.layouts[0].title = "Changed Layout";
    await hydrateDocsDatabase(target, changed);

    const layouts = await target.layouts.select().execute();
    expect(layouts).toHaveLength(1);
    expect(layouts[0].title).toBe("Changed Layout");
    expect(await tableCounts(target)).toEqual(before);
  });

  it("rejects an invalid snapshot before hydrating any table", async () => {
    const snapshot = await exportFixtureSnapshot();
    snapshot.tables.pages[0].layoutId = "layout:missing";
    const target = new DocsDatabase();
    await target.initialize();

    await expect(hydrateDocsDatabase(target, snapshot)).rejects.toThrow(
      /Unresolved reference "layout:missing"/
    );
    expect(await tableCounts(target)).toEqual(
      Object.fromEntries(DocsTables.map((table) => [table.name, 0]))
    );
  });

  it("hydrates a seeded database without losing unrelated records", async () => {
    const source = await createSeededDatabase();
    const snapshot = await exportDocsSnapshot(source);
    const target = new DocsDatabase();
    await target.initialize();
    await target.layouts.create(
      new DocLayoutModel({
        uid: "layout:unrelated",
        name: "unrelated",
        tag: "div",
      })
    );

    await hydrateDocsDatabase(target, snapshot);

    expect(await target.layouts.read("layout:unrelated")).toBeDefined();
    expect(await tableCounts(target)).toMatchObject({
      layouts: snapshot.tables.layouts.length + 1,
    });
  });
});
