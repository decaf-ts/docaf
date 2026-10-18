import { DocsDatabase } from "../../src/database/DocsDatabase";
import { DocsQueryService } from "../../src/query/DocsQueryService";
import { rebuildDocLookups } from "../../src/services/DocsLookupService";
import {
  FIXTURE_LONGNAMES,
  FIXTURE_PROJECT,
  createSeededDatabase,
  fixtureUids,
} from "./support/fixtures";

describe("DocsQueryService", () => {
  let database: DocsDatabase;
  let queries: DocsQueryService;

  beforeEach(async () => {
    database = await createSeededDatabase();
    await rebuildDocLookups(database);
    queries = new DocsQueryService(database);
  });

  it("finds doclets by identity and classification", async () => {
    expect(await queries.findDocletByUid(fixtureUids.classDoclet)).toHaveLength(1);
    expect(await queries.findByLongname(FIXTURE_LONGNAMES.method)).toHaveLength(2);
    expect(await queries.findByKind("class")).toHaveLength(1);
    expect(await queries.findByPackage(FIXTURE_PROJECT.name)).toHaveLength(3);
    expect(await queries.findMembers(FIXTURE_LONGNAMES.class)).toHaveLength(2);
    expect(await queries.findMemberOfUid(fixtureUids.classDoclet)).toHaveLength(
      2
    );
  });

  it("filters by category with and without a subcategory", async () => {
    expect(await queries.findByCategory("classes")).toHaveLength(1);
    expect(await queries.findByCategory("classes", "fixtures")).toHaveLength(1);
    expect(await queries.findByCategory("classes", "missing")).toHaveLength(0);
  });

  it("returns all doclets sorted by uid", async () => {
    const doclets = await queries.allDoclets();
    const uids = doclets.map((doclet) => doclet.uid);

    expect(uids).toEqual([...uids].sort());
    expect(uids).toHaveLength(3);
  });

  it("resolves lookup posting lists into doclets", async () => {
    expect(await queries.findLookups("package", FIXTURE_PROJECT.name)).toHaveLength(
      1
    );
    const members = await queries.findLookupDoclets(
      "memberof",
      FIXTURE_LONGNAMES.class
    );

    expect(members.map((doclet) => doclet.uid).sort()).toEqual(
      [fixtureUids.methodDoclet, fixtureUids.overloadDoclet].sort()
    );
    expect(
      await queries.findLookupDoclets("longname", FIXTURE_LONGNAMES.method)
    ).toHaveLength(2);
  });

  it("finds pages, routes, layouts, navigation, and links", async () => {
    expect(
      await queries.findPageByRoute("/docs/getting-started")
    ).toHaveLength(1);
    expect(await queries.findPageByUid(fixtureUids.page)).toHaveLength(1);
    expect(await queries.findRoute("/docs/getting-started")).toHaveLength(1);
    expect(
      await queries.findRoute("/old/getting-started")
    ).toHaveLength(0);
    expect(await queries.findLayoutByUid(fixtureUids.layout)).toHaveLength(1);
    expect(await queries.findNavigation(fixtureUids.navigation)).toHaveLength(1);
    expect(
      await queries.findNavigationChildren(
        fixtureUids.navigation,
        fixtureUids.page
      )
    ).toHaveLength(0);
    expect(
      await queries.findNavigationChildren(fixtureUids.navigation)
    ).toHaveLength(1);
    expect(
      await queries.findLinksFor(FIXTURE_LONGNAMES.method)
    ).toHaveLength(1);
  });

  it("finds tutorials, components, and search entries", async () => {
    expect(
      await queries.findTutorialByUid(fixtureUids.tutorial)
    ).toHaveLength(1);
    expect(await queries.findTutorialByName("fixture-guide")).toHaveLength(1);
    expect(await queries.findComponentsByFramework("angular")).toHaveLength(1);
    expect(await queries.findComponentByUid(fixtureUids.component)).toHaveLength(
      1
    );
    expect(
      await queries.findSearchEntryByDocletUid(fixtureUids.methodDoclet)
    ).toHaveLength(1);
  });

  it("searches case-insensitively across the search index", async () => {
    expect((await queries.search("FIXTURE")).map((entry) => entry.uid)).toEqual([
      fixtureUids.search,
    ]);
    expect(await queries.search("run")).toHaveLength(1);
    expect(await queries.search("   ")).toEqual([]);
    expect(await queries.search("term-that-does-not-exist")).toEqual([]);
  });

  it("applies the search limit", async () => {
    const results = await queries.search("fixture", 1);
    expect(results).toHaveLength(1);
    expect(results[0].rank).toBeGreaterThanOrEqual(0);
  });
});
