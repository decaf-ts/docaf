import "@decaf-ts/core";
import { NotFoundError } from "@decaf-ts/db-decorators";
import { Model } from "@decaf-ts/decorator-validation";
import { DocsDatabase } from "../../src/database/DocsDatabase";
import { DocsModel } from "../../src/models";
import { DocsTableNames, DocsTables } from "../../src/snapshot";
import {
  TABLE_UPDATE_PATCHES,
  fixtureModels,
} from "./support/fixtures";

const EXPECTED_TABLE_NAMES: Record<string, string> = {
  doclets: "docs_doclets",
  tags: "docs_tags",
  types: "docs_types",
  parameters: "docs_parameters",
  returns: "docs_returns",
  signatures: "docs_signatures",
  examples: "docs_examples",
  sources: "docs_sources",
  references: "docs_references",
  components: "docs_components",
  componentProperties: "docs_component_properties",
  componentEvents: "docs_component_events",
  componentPreviews: "docs_component_previews",
  tutorials: "docs_tutorials",
  pages: "docs_pages",
  sections: "docs_sections",
  routes: "docs_routes",
  links: "docs_links",
  navigation: "docs_navigation",
  search: "docs_search",
  lookups: "docs_lookups",
  layouts: "docs_layouts",
  manifests: "docs_manifests",
};

describe("docaf model contracts", () => {
  it("covers every persistent docs table exactly once", () => {
    expect(DocsTableNames).toHaveLength(23);
    expect(new Set(DocsTableNames).size).toBe(23);
    expect([...DocsTableNames]).toEqual(Object.keys(EXPECTED_TABLE_NAMES));
  });

  it.each(DocsTables.map((table) => [table.name, table] as const))(
    "registers %s as a Decaf table model with a non-generated uid primary key",
    (name, table) => {
      const model = new table.model({ uid: `${name}-uid` });

      expect(model).toBeInstanceOf(DocsModel);
      expect(Model.isModel(model)).toBe(true);
      expect(Model.tableName(table.model)).toBe(EXPECTED_TABLE_NAMES[name]);
      expect(Model.pk(model)).toBe("uid");
      expect((model as DocsModel).uid).toBe(`${name}-uid`);
    }
  );

  it("defaults array properties to lists rather than undefined", () => {
    const table = DocsTables.find((entry) => entry.name === "doclets")!;
    const doclet = new table.model({ uid: "doclet:defaults" });
    const docletRecord = doclet as unknown as Record<string, unknown>;

    for (const field of [
      "signatureIds",
      "typeIds",
      "propertyIds",
      "exampleIds",
      "tagIds",
      "referenceIds",
      "tutorialIds",
      "augments",
      "implements",
      "mixes",
      "overrides",
      "inherits",
      "see",
      "requires",
      "fires",
      "listens",
    ])
      expect(Array.isArray(docletRecord[field])).toBe(true);
  });
});

describe("docs tables persist through their RamAdapter repositories", () => {
  let database: DocsDatabase;

  beforeEach(async () => {
    database = new DocsDatabase();
    await database.initialize();
  });

  it.each(DocsTableNames)(
    "%s round-trips create/read/update/delete",
    async (name) => {
      const table = DocsTables.find((entry) => entry.name === name)!;
      const repository = database.repositories()[name];
      const model = fixtureModels()[name][0];
      const uid = (model as DocsModel).uid;

      const created = await repository.create(model);
      expect((created as DocsModel).uid).toBe(uid);

      const read = await repository.read(uid);
      expect((read as DocsModel).uid).toBe(uid);
      expect(table.codec.encode(read as never)).toEqual(
        table.codec.encode(model)
      );

      const patch = TABLE_UPDATE_PATCHES[name];
      const updated = table.codec.decode({
        ...table.codec.encode(read as never),
        ...patch,
      } as never);
      await repository.update(updated);

      const reread = await repository.read(uid);
      expect(table.codec.encode(reread as never)).toMatchObject(patch);

      const deleted = await repository.delete(uid);
      expect((deleted as DocsModel).uid).toBe(uid);
      await expect(repository.read(uid)).rejects.toBeInstanceOf(NotFoundError);

      const remaining = await repository.select().execute();
      expect(remaining).toHaveLength(0);
    }
  );
});
