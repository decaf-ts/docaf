import type { Repository } from "@decaf-ts/core";
import type { RamAdapter } from "@decaf-ts/core/ram";
import { DocsDatabase } from "../../../src/database/DocsDatabase";
import { DocsIds, type DocsModel } from "../../../src/models";
import {
  DocsTableNames,
  DocsTables,
  type DocsSnapshotTables,
  type DocsSnapshotV1,
  type DocsTableName,
  exportDocsSnapshot,
} from "../../../src/snapshot";

export const FIXTURE_PROJECT = {
  name: "docaf-fixture",
  version: "1.2.3",
} as const;

export const FIXTURE_BUILD = {
  id: "build-fixture-1",
  sourceRevision: "rev-fixture-1",
} as const;

const PACKAGE_NAME = "docaf-fixture";
const CLASS_LONGNAME = `${PACKAGE_NAME}.FixtureClass`;
const METHOD_LONGNAME = `${CLASS_LONGNAME}.run`;
const PAGE_ROUTE = "/docs/getting-started";

export const fixtureUids = {
  layout: DocsIds.layout("default"),
  navigation: DocsIds.navigation("main"),
  page: DocsIds.page("getting-started"),
  section: DocsIds.section(
    DocsIds.page("getting-started"),
    "intro"
  ),
  route: DocsIds.route(PAGE_ROUTE),
  navigationItem: DocsIds.navigationItem(
    DocsIds.navigation("main"),
    DocsIds.page("getting-started")
  ),
  tutorial: DocsIds.tutorial("fixture-guide"),
  classDoclet: DocsIds.doclet(PACKAGE_NAME, "FixtureClass"),
  methodDoclet: DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 0),
  overloadDoclet: DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 1),
  signature: DocsIds.signature(
    DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 0),
    0
  ),
  parameter: DocsIds.parameter(
    DocsIds.signature(DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 0), 0),
    0
  ),
  returns: DocsIds.returns(
    DocsIds.signature(DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 0), 0)
  ),
  type: DocsIds.type(
    DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 0),
    "parameter",
    0
  ),
  tag: DocsIds.tag(
    DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 0),
    "param",
    0
  ),
  example: DocsIds.example(
    DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 0),
    0
  ),
  source: DocsIds.source(PACKAGE_NAME, "fixture.ts", 12, 4),
  reference: DocsIds.reference(
    DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 0),
    DocsIds.doclet(PACKAGE_NAME, "FixtureClass"),
    "see",
    0
  ),
  component: DocsIds.component(
    "angular",
    "fixture.ts",
    "FixtureComponent"
  ),
  componentProperty: DocsIds.componentProperty(
    DocsIds.component("angular", "fixture.ts", "FixtureComponent"),
    "label"
  ),
  componentEvent: DocsIds.componentEvent(
    DocsIds.component("angular", "fixture.ts", "FixtureComponent"),
    "clicked"
  ),
  componentPreview: DocsIds.componentPreview(
    DocsIds.component("angular", "fixture.ts", "FixtureComponent"),
    "default"
  ),
  link: DocsIds.link(
    DocsIds.doclet(PACKAGE_NAME, "FixtureClass"),
    DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 0),
    "member"
  ),
  search: DocsIds.search(
    DocsIds.member(PACKAGE_NAME, "FixtureClass", "run", 0)
  ),
  manifest: DocsIds.manifest(
    FIXTURE_PROJECT.name,
    FIXTURE_BUILD.id
  ),
} as const;

export const FIXTURE_LONGNAMES = {
  class: CLASS_LONGNAME,
  method: METHOD_LONGNAME,
} as const;

function emptyDocletFields(): DocsSnapshotTables["doclets"][number] {
  return {
    signatureIds: [],
    typeIds: [],
    propertyIds: [],
    exampleIds: [],
    tagIds: [],
    referenceIds: [],
    tutorialIds: [],
    augments: [],
    implements: [],
    mixes: [],
    overrides: [],
    inherits: [],
    see: [],
    requires: [],
    fires: [],
    listens: [],
  };
}

function buildTables(): DocsSnapshotTables {
  const uid = fixtureUids;

  const doclets: DocsSnapshotTables["doclets"] = [
    {
      ...emptyDocletFields(),
      uid: uid.classDoclet,
      name: "FixtureClass",
      longname: CLASS_LONGNAME,
      kind: "class",
      package: PACKAGE_NAME,
      scope: "global",
      description: "Fixture class doclet",
      classdesc: "Fixture class description",
      summary: "Fixture class summary",
      access: "public",
      category: "classes",
      subCategory: "fixtures",
      order: 0,
      componentId: uid.component,
      sourceId: uid.source,
      linkId: uid.link,
      tutorialIds: [uid.tutorial],
      metadata: { since: "1.0.0" },
    },
    {
      ...emptyDocletFields(),
      uid: uid.methodDoclet,
      name: "run",
      longname: METHOD_LONGNAME,
      kind: "function",
      package: PACKAGE_NAME,
      memberof: CLASS_LONGNAME,
      memberofUid: uid.classDoclet,
      scope: "instance",
      description: "Runs the fixture",
      summary: "Run the fixture",
      access: "public",
      async: true,
      order: 1,
      sourceId: uid.source,
      signatureIds: [uid.signature],
      typeIds: [uid.type],
      exampleIds: [uid.example],
      tagIds: [uid.tag],
      referenceIds: [uid.reference],
      tutorialIds: [uid.tutorial],
    },
    {
      ...emptyDocletFields(),
      uid: uid.overloadDoclet,
      name: "run",
      longname: METHOD_LONGNAME,
      kind: "function",
      package: PACKAGE_NAME,
      memberof: CLASS_LONGNAME,
      memberofUid: uid.classDoclet,
      scope: "instance",
      description: "Runs the fixture with another overload",
      order: 2,
    },
  ];

  const tags: DocsSnapshotTables["tags"] = [
    {
      uid: uid.tag,
      ownerUid: uid.methodDoclet,
      name: "param",
      value: "input",
      originalValue: "input",
      kind: "param",
      comment: "Fixture parameter tag",
    },
  ];

  const types: DocsSnapshotTables["types"] = [
    {
      uid: uid.type,
      ownerUid: uid.methodDoclet,
      role: "parameter",
      index: 0,
      text: "string",
      normalized: "string",
      kind: "primitive",
      arguments: [],
      nullable: false,
      optional: false,
      readonly: false,
    },
  ];

  const parameters: DocsSnapshotTables["parameters"] = [
    {
      uid: uid.parameter,
      signatureUid: uid.signature,
      name: "input",
      index: 0,
      typeText: "string",
      typeId: uid.type,
      optional: false,
      rest: false,
      defaultValue: "\"fixture\"",
      description: "Fixture input",
    },
  ];

  const returns: DocsSnapshotTables["returns"] = [
    {
      uid: uid.returns,
      signatureUid: uid.signature,
      role: "returns",
      typeText: "void",
      typeId: uid.type,
      description: "Nothing is returned",
      nullable: false,
      elementTypeText: "void",
    },
  ];

  const signatures: DocsSnapshotTables["signatures"] = [
    {
      uid: uid.signature,
      docletUid: uid.methodDoclet,
      index: 0,
      kind: "function",
      name: "run",
      signatureText: "run(input: string): void",
      parametersText: "input: string",
      access: "public",
      description: "Runs the fixture",
      async: true,
      parameterIds: [uid.parameter],
      returnId: uid.returns,
      typeIds: [uid.type],
      referenceIds: [uid.reference],
    },
  ];

  const examples: DocsSnapshotTables["examples"] = [
    {
      uid: uid.example,
      ownerUid: uid.methodDoclet,
      index: 0,
      caption: "Run the fixture",
      code: "fixture.run(\"value\")",
      language: "ts",
      escaped: false,
    },
  ];

  const sources: DocsSnapshotTables["sources"] = [
    {
      uid: uid.source,
      package: PACKAGE_NAME,
      fileName: "fixture.ts",
      repository: "decaf-ts/docaf",
      path: "tests/fixture.ts",
      line: 12,
      column: 4,
      url: "https://example.test/fixture.ts#L12",
      revision: FIXTURE_BUILD.sourceRevision,
    },
  ];

  const references: DocsSnapshotTables["references"] = [
    {
      uid: uid.reference,
      ownerUid: uid.methodDoclet,
      index: 0,
      kind: "see",
      targetLongname: CLASS_LONGNAME,
      targetUid: uid.classDoclet,
      anchor: "fixture-class",
      route: PAGE_ROUTE,
    },
  ];

  const components: DocsSnapshotTables["components"] = [
    {
      uid: uid.component,
      docletUid: uid.classDoclet,
      framework: "angular",
      name: "FixtureComponent",
      exportName: "FixtureComponent",
      sourceFile: "fixture.ts",
      selector: "fixture-component",
      standalone: true,
      propertyUids: [uid.componentProperty],
      eventUids: [uid.componentEvent],
      previewUids: [uid.componentPreview],
    },
  ];

  const componentProperties: DocsSnapshotTables["componentProperties"] = [
    {
      uid: uid.componentProperty,
      componentUid: uid.component,
      name: "label",
      kind: "input",
      alias: "label",
      typeText: "string",
      typeId: uid.type,
      optional: false,
      required: true,
      defaultValue: "Fixture",
      description: "Component label",
    },
  ];

  const componentEvents: DocsSnapshotTables["componentEvents"] = [
    {
      uid: uid.componentEvent,
      componentUid: uid.component,
      name: "clicked",
      typeText: "EventEmitter<void>",
      payloadTypeText: "void",
      payloadTypeId: uid.type,
      description: "Emitted when clicked",
    },
  ];

  const componentPreviews: DocsSnapshotTables["componentPreviews"] = [
    {
      uid: uid.componentPreview,
      componentUid: uid.component,
      name: "default",
      kind: "native",
      framework: "angular",
      entry: "fixture.component.ts",
      moduleId: "FixtureModule",
      sourceFile: "fixture.component.ts",
      controls: ["label"],
      inputDefaults: { label: "Fixture" },
    },
  ];

  const tutorials: DocsSnapshotTables["tutorials"] = [
    {
      uid: uid.tutorial,
      name: "fixture-guide",
      title: "Fixture Guide",
      description: "A guide for the fixture",
      content: "# Fixture Guide",
      route: PAGE_ROUTE,
      sourceFile: "fixture-guide.md",
      pageUid: uid.page,
      order: 0,
      childUids: [],
      docletUids: [uid.classDoclet, uid.methodDoclet],
    },
  ];

  const pages: DocsSnapshotTables["pages"] = [
    {
      uid: uid.page,
      title: "Getting Started",
      kind: "guide",
      route: PAGE_ROUTE,
      layoutId: uid.layout,
      routeId: uid.route,
      navigationUid: uid.navigation,
      order: 0,
      docletUids: [uid.classDoclet, uid.methodDoclet],
      sectionUids: [uid.section],
      tutorialUids: [uid.tutorial],
    },
  ];

  const sections: DocsSnapshotTables["sections"] = [
    {
      uid: uid.section,
      pageUid: uid.page,
      key: "intro",
      kind: "markdown",
      title: "Introduction",
      content: "Fixture introduction",
      order: 0,
      navigationUid: uid.navigation,
      docletUids: [uid.methodDoclet],
    },
  ];

  const routes: DocsSnapshotTables["routes"] = [
    {
      uid: uid.route,
      route: PAGE_ROUTE,
      pageUid: uid.page,
      kind: "page",
      name: "Getting Started",
      anchor: "getting-started",
      legacyRoutes: ["/old/getting-started"],
    },
  ];

  const links: DocsSnapshotTables["links"] = [
    {
      uid: uid.link,
      sourceUid: uid.classDoclet,
      role: "member",
      targetLongname: METHOD_LONGNAME,
      targetUid: uid.methodDoclet,
      route: PAGE_ROUTE,
      anchor: "run",
    },
  ];

  const navigation: DocsSnapshotTables["navigation"] = [
    {
      uid: uid.navigationItem,
      navigationUid: uid.navigation,
      label: "Getting Started",
      kind: "page",
      route: PAGE_ROUTE,
      anchor: "getting-started",
      pageUid: uid.page,
      order: 0,
      childUids: [],
    },
  ];

  const search: DocsSnapshotTables["search"] = [
    {
      uid: uid.search,
      docletUid: uid.methodDoclet,
      name: "run",
      longname: METHOD_LONGNAME,
      kind: "function",
      category: "methods",
      subCategory: "fixtures",
      summary: "Run the fixture",
      route: PAGE_ROUTE,
      anchor: "run",
      rank: 1,
      tokens: ["run", "fixture"],
    },
  ];

  const lookup = (
    lookupKind: string,
    value: string,
    docletUids: string[] = [],
    pageUids: string[] = []
  ): DocsSnapshotTables["lookups"][number] => ({
    uid: DocsIds.lookup(lookupKind, value),
    lookupKind,
    value,
    docletUids,
    pageUids,
  });

  const lookups: DocsSnapshotTables["lookups"] = [
    lookup("kind", "class", [uid.classDoclet]),
    lookup("kind", "function", [uid.methodDoclet, uid.overloadDoclet]),
    lookup("memberof", CLASS_LONGNAME, [uid.methodDoclet, uid.overloadDoclet]),
    lookup("longname", CLASS_LONGNAME, [uid.classDoclet]),
    lookup("longname", METHOD_LONGNAME, [uid.methodDoclet, uid.overloadDoclet]),
    lookup("category", "classes", [uid.classDoclet]),
    lookup("subcategory", "fixtures", [uid.classDoclet]),
    lookup("package", PACKAGE_NAME, [
      uid.classDoclet,
      uid.methodDoclet,
      uid.overloadDoclet,
    ]),
    lookup("route", PAGE_ROUTE, [], [uid.page]),
    lookup("page-kind", "guide", [], [uid.page]),
  ];

  const layouts: DocsSnapshotTables["layouts"] = [
    {
      uid: uid.layout,
      name: "default",
      tag: "article",
      title: "Default Layout",
      order: 0,
      slots: ["main"],
      children: [],
      config: { toc: true, width: 320 },
    },
  ];

  const tables: DocsSnapshotTables = {
    doclets,
    tags,
    types,
    parameters,
    returns,
    signatures,
    examples,
    sources,
    references,
    components,
    componentProperties,
    componentEvents,
    componentPreviews,
    tutorials,
    pages,
    sections,
    routes,
    links,
    navigation,
    search,
    lookups,
    layouts,
    manifests: [],
  };

  const tableNames = [...DocsTableNames];
  tables.manifests = [
    {
      uid: uid.manifest,
      schemaVersion: 1,
      projectName: FIXTURE_PROJECT.name,
      projectVersion: FIXTURE_PROJECT.version,
      buildId: FIXTURE_BUILD.id,
      sourceRevision: FIXTURE_BUILD.sourceRevision,
      generator: "docaf-test-fixture",
      tableNames,
      counts: Object.fromEntries(
        tableNames.map((name) => [
          name,
          name === "manifests" ? 1 : tables[name].length,
        ])
      ),
    },
  ];

  return tables;
}

export interface FixtureOptions {
  includeManifest?: boolean;
}

export function docsFixture(options: FixtureOptions = {}): DocsSnapshotV1 {
  const tables = buildTables();
  if (options.includeManifest === false) tables.manifests = [];
  return {
    schemaVersion: 1,
    project: { ...FIXTURE_PROJECT },
    build: { ...FIXTURE_BUILD },
    tables,
  };
}

export function cloneSnapshot(snapshot: DocsSnapshotV1): DocsSnapshotV1 {
  return JSON.parse(JSON.stringify(snapshot)) as DocsSnapshotV1;
}

export function cloneFixture(options: FixtureOptions = {}): DocsSnapshotV1 {
  return cloneSnapshot(docsFixture(options));
}

export function fixtureModels(): Record<DocsTableName, DocsModel[]> {
  const snapshot = docsFixture();
  return Object.fromEntries(
    DocsTables.map((table) => [
      table.name,
      snapshot.tables[table.name].map((record) => table.codec.decode(record)),
    ])
  ) as Record<DocsTableName, DocsModel[]>;
}

export function fixtureModel(table: DocsTableName): DocsModel {
  return fixtureModels()[table][0];
}

export async function createSeededDatabase(
  options: FixtureOptions = {}
): Promise<DocsDatabase> {
  const database = new DocsDatabase();
  await seedDocsDatabase(database, options);
  return database;
}

export async function seedDocsDatabase(
  database: DocsDatabase,
  options: FixtureOptions = {}
): Promise<DocsDatabase> {
  await database.initialize();
  const snapshot = docsFixture(options);
  for (const table of DocsTables) {
    const records = snapshot.tables[table.name];
    if (!records.length) continue;
    const models = records.map((record) =>
      table.codec.decode(record)
    ) as DocsModel[];
    const repository = database.repositories()[table.name] as Repository<
      DocsModel,
      RamAdapter
    >;
    await repository.createAll(models);
  }
  return database;
}

export async function exportFixtureSnapshot(
  options: FixtureOptions = {}
): Promise<DocsSnapshotV1> {
  const database = await createSeededDatabase(options);
  return exportDocsSnapshot(database);
}

export const TABLE_UPDATE_PATCHES: Record<
  DocsTableName,
  Record<string, string | number | boolean>
> = {
  doclets: { summary: "updated summary" },
  tags: { comment: "updated comment" },
  types: { normalized: "updated-type" },
  parameters: { description: "updated parameter" },
  returns: { description: "updated return" },
  signatures: { description: "updated signature" },
  examples: { caption: "updated caption" },
  sources: { url: "https://example.test/updated.ts" },
  references: { anchor: "updated-anchor" },
  components: { selector: "updated-selector" },
  componentProperties: { description: "updated property" },
  componentEvents: { description: "updated event" },
  componentPreviews: { entry: "updated-preview.ts" },
  tutorials: { description: "updated tutorial" },
  pages: { order: 7 },
  sections: { order: 7 },
  routes: { name: "Updated Route" },
  links: { anchor: "updated-link" },
  navigation: { order: 7 },
  search: { summary: "updated search summary" },
  lookups: { order: 7 },
  layouts: { title: "Updated Layout" },
  manifests: { generator: "docaf-updated" },
};
