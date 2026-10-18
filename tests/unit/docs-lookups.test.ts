import {
  buildDocLookupModels,
  rebuildDocLookups,
} from "../../src/services/DocsLookupService";
import { DocsDatabase } from "../../src/database/DocsDatabase";
import { DocletModel } from "../../src/models";
import {
  FIXTURE_LONGNAMES,
  FIXTURE_PROJECT,
  createSeededDatabase,
  fixtureUids,
} from "./support/fixtures";

describe("docs lookup posting lists", () => {
  let database: DocsDatabase;

  beforeEach(async () => {
    database = await createSeededDatabase();
  });

  it("builds every required lookup kind from doclets and pages", () => {
    const kinds = new Set(
      buildDocLookupModels(
        [],
        [
          {
            uid: fixtureUids.page,
            route: "/docs/getting-started",
            kind: "guide",
          },
        ]
      ).map((lookup) => lookup.lookupKind)
    );

    expect(kinds).toEqual(new Set(["route", "page-kind"]));
  });

  it("only points at existing doclet and page records", async () => {
    const lookups = await rebuildDocLookups(database);
    const docletUids = new Set(
      (await database.doclets.select().execute()).map((doclet) => doclet.uid)
    );
    const pageUids = new Set(
      (await database.pages.select().execute()).map((page) => page.uid)
    );

    expect(lookups.length).toBeGreaterThan(0);
    for (const lookup of lookups) {
      for (const uid of lookup.docletUids) expect(docletUids.has(uid)).toBe(true);
      for (const uid of lookup.pageUids) expect(pageUids.has(uid)).toBe(true);
    }

    const kinds = new Set(lookups.map((lookup) => lookup.lookupKind));
    expect(kinds).toEqual(
      new Set([
        "kind",
        "memberof",
        "longname",
        "category",
        "subcategory",
        "package",
        "route",
        "page-kind",
      ])
    );
  });

  it("sorts posting lists and does not duplicate entries", async () => {
    const lookups = await rebuildDocLookups(database);

    for (const lookup of lookups) {
      expect(lookup.docletUids).toEqual([...lookup.docletUids].sort());
      expect(lookup.pageUids).toEqual([...lookup.pageUids].sort());
      expect(new Set(lookup.docletUids).size).toBe(lookup.docletUids.length);
      expect(new Set(lookup.pageUids).size).toBe(lookup.pageUids.length);
    }

    const memberof = lookups.find(
      (lookup) =>
        lookup.lookupKind === "memberof" &&
        lookup.value === FIXTURE_LONGNAMES.class
    );
    expect(memberof).toBeDefined();
    expect(memberof!.docletUids).toEqual(
      [fixtureUids.methodDoclet, fixtureUids.overloadDoclet].sort()
    );
  });

  it("is idempotent across repeated rebuilds", async () => {
    const first = await rebuildDocLookups(database);
    const firstCount = (await database.lookups.select().execute()).length;
    const second = await rebuildDocLookups(database);
    const secondCount = (await database.lookups.select().execute()).length;

    expect(firstCount).toBe(first.length);
    expect(secondCount).toBe(firstCount);
    expect(second).toEqual(first);
  });

  it("rebuilds from the current doclet and page state", async () => {
    const lookups = buildDocLookupModels(
      [
        new DocletModel({
          uid: "doclet:added",
          name: "Added",
          longname: `${FIXTURE_PROJECT.name}.Added`,
          kind: "class",
          package: FIXTURE_PROJECT.name,
        }),
      ],
      []
    );

    expect(lookups.map((lookup) => lookup.lookupKind)).toEqual([
      "kind",
      "longname",
      "package",
    ]);
    expect(lookups.every((lookup) => lookup.docletUids[0] === "doclet:added")).toBe(
      true
    );
  });
});
