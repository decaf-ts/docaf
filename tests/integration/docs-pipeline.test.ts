import fs from "node:fs";
import path from "node:path";
import { DocsDatabase } from "../../src/database/DocsDatabase";
import { DocumentationCompiler } from "../../src/generator/compiler/DocumentationCompiler";
import { DocTagModel, DocsIds } from "../../src/models";
import { DocsTableNames, stableStringify } from "../../src/snapshot";
import { VERTICAL_SLICE } from "../unit/support/typescript";

const PROJECT = { name: "@fixture/adapter", version: "1.0.0" };

function compilerFor(
  database: DocsDatabase,
  publisher?: {
    basePath?: string;
    tutorials?: readonly {
      name: string;
      title?: string;
      content?: string;
      parentName?: string;
    }[];
  }
): DocumentationCompiler {
  return new DocumentationCompiler({
    project: PROJECT,
    rootNames: [VERTICAL_SLICE],
    database,
    snapshot: { id: "pipeline-build", sourceRevision: "local" },
    ...(publisher ? { publisher } : {}),
  });
}

function docletNamed(
  doclets: readonly { name: string; kind: string }[],
  name: string,
  kind?: string
) {
  const found = doclets.find(
    (doclet) => doclet.name === name && (!kind || doclet.kind === kind)
  );
  if (!found) throw new Error(`Missing doclet ${name}`);
  return found as (typeof doclets)[number] & {
    uid: string;
    longname: string;
    category?: string;
    subCategory?: string;
    componentId?: string;
    tutorialIds: string[];
  };
}

describe("documentation compiler pipeline", () => {
  it("extracts the vertical slice into persisted extraction tables", async () => {
    const database = new DocsDatabase();
    const compiler = compilerFor(database);

    const extraction = await compiler.extract(database);

    expect(extraction.counts).toEqual({
      doclets: 11,
      tags: 15,
      types: 8,
      parameters: 2,
      returns: 1,
      signatures: 4,
      examples: 0,
      sources: 11,
      references: 1,
      components: 1,
      componentProperties: 2,
      componentEvents: 1,
      componentPreviews: 0,
      tutorials: 0,
      pages: 0,
      sections: 0,
      routes: 0,
      links: 0,
      navigation: 0,
      search: 0,
      lookups: 0,
      layouts: 0,
      manifests: 0,
    });
    expect(extraction.diagnostics.entries).toEqual([]);

    const base = docletNamed(extraction.doclets, "BaseAdapter", "interface");
    const ram = docletNamed(extraction.doclets, "RamAdapter", "class");
    const config = docletNamed(extraction.doclets, "AdapterConfig", "interface");
    const widget = docletNamed(extraction.doclets, "DocWidgetComponent", "class");
    const read = docletNamed(extraction.doclets, "read", "function");

    expect(base.category).toBe("Adapters");
    expect(base.subCategory).toBe("Contracts");
    expect(ram.category).toBe("Adapters");
    expect(ram.subCategory).toBe("Memory");
    expect(config.category).toBe("Adapters");
    expect(config.subCategory).toBe("Configuration");
    expect(widget.category).toBe("Components");
    expect(widget.subCategory).toBe("Widgets");
    expect(typeof widget.componentId).toBe("string");
    expect(read).toMatchObject({ kind: "function", memberof: ram.longname });

    expect(extraction.components).toHaveLength(1);
    expect(extraction.components[0]).toMatchObject({
      name: "DocWidgetComponent",
      selector: "doc-widget",
      uid: widget.componentId,
    });
    expect(extraction.componentProperties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "count",
          alias: "itemCount",
          required: true,
          kind: "input",
        }),
        expect.objectContaining({
          name: "label",
          required: false,
          kind: "input",
        }),
      ])
    );
    expect(extraction.componentEvents).toEqual([
      expect.objectContaining({ name: "changed", componentUid: widget.componentId }),
    ]);

    expect(await database.doclets.select().execute()).toHaveLength(11);
    expect(await database.components.select().execute()).toHaveLength(1);
    expect(await database.componentProperties.select().execute()).toHaveLength(2);
    expect(await database.componentEvents.select().execute()).toHaveLength(1);
  });

  it("publishes deterministic pages, links, navigation, search and snapshots", async () => {
    const database = new DocsDatabase();
    const compiler = new DocumentationCompiler({
      project: PROJECT,
      rootNames: [VERTICAL_SLICE],
      database,
      snapshot: { id: "build-one", sourceRevision: "rev-1" },
    });

    const result = await compiler.build(database);
    const { publication } = result;

    expect(publication.counts).toEqual({
      doclets: 11,
      tags: 15,
      types: 9,
      parameters: 2,
      returns: 1,
      signatures: 4,
      examples: 0,
      sources: 11,
      references: 1,
      components: 1,
      componentProperties: 2,
      componentEvents: 1,
      componentPreviews: 0,
      tutorials: 0,
      pages: 5,
      sections: 15,
      routes: 5,
      links: 11,
      navigation: 14,
      search: 11,
      layouts: 7,
      manifests: 1,
    });

    expect(result.pages.map((page) => page.route)).toEqual(
      expect.arrayContaining([
        "/",
        "/docs/classes/RamAdapter",
        "/docs/interfaces/BaseAdapter",
        "/docs/interfaces/AdapterConfig",
        "/docs/components/DocWidgetComponent",
      ])
    );
    expect(result.pages.filter((page) => page.kind === "tutorial")).toHaveLength(
      0
    );
    expect(result.pages[0]).toMatchObject({ kind: "home", route: "/" });
    expect(publication.routes).toHaveLength(publication.pages.length);
    for (const page of publication.pages) {
      const route = publication.routes.find(
        (candidate) => candidate.route === page.route
      );
      expect(route).toMatchObject({ pageUid: page.uid, kind: page.kind });
    }

    const readLink = publication.links.find(
      (link) => link.targetLongname === "@fixture/adapter.RamAdapter.read"
    );
    expect(readLink).toMatchObject({
      route: "/docs/classes/RamAdapter",
      anchor: "read",
    });
    const baseLink = publication.links.find(
      (link) => link.targetLongname === "@fixture/adapter.BaseAdapter"
    );
    expect(baseLink).toMatchObject({
      route: "/docs/interfaces/BaseAdapter",
      anchor: undefined,
    });
    const ramDoclet = docletNamed(publication.dataset.doclets, "RamAdapter");
    const baseDoclet = docletNamed(
      publication.dataset.doclets,
      "BaseAdapter",
      "interface"
    );
    const implementsReferences = publication.dataset.references.filter(
      (reference) =>
        reference.ownerUid === ramDoclet.uid &&
        reference.kind === "implements"
    );
    expect(implementsReferences).toHaveLength(1);
    expect(implementsReferences[0]).toMatchObject({
      targetLongname: baseDoclet.longname,
      targetUid: baseDoclet.uid,
    });
    expect(ramDoclet.referenceIds).toContain(implementsReferences[0].uid);

    const ramPage = publication.pages.find(
      (page) => page.route === "/docs/classes/RamAdapter"
    )!;
    const ramSections = publication.sections
      .filter((section) => section.pageUid === ramPage.uid)
      .sort((a, b) => a.order - b.order);
    expect(ramSections.map((section) => section.kind)).toEqual([
      "markdown",
      "signature",
      "members",
      "source",
    ]);
    const ram = docletNamed(result.extraction.doclets, "RamAdapter");
    const constructor = docletNamed(
      result.extraction.doclets,
      "constructor",
      "constructor"
    );
    const read = docletNamed(result.extraction.doclets, "read", "function");
    expect(
      ramSections.find((section) => section.kind === "members")?.docletUids
    ).toEqual(expect.arrayContaining([constructor.uid, read.uid]));

    const constructorModel = publication.dataset.doclets.find(
      (doclet) => doclet.uid === constructor.uid
    )!;
    expect(constructorModel.type).toBeUndefined();
    expect(constructorModel.typeIds).toEqual([]);
    expect(
      publication.dataset.tags.filter(
        (tag) =>
          tag.ownerUid === constructor.uid &&
          (tag.name === "return" || tag.name === "returns")
      )
    ).toEqual([]);
    expect(
      publication.dataset.types.filter(
        (type) =>
          type.ownerUid === constructor.uid && type.role === "returns"
      )
    ).toEqual([]);
    const constructorSignatureIds = publication.dataset.signatures
      .filter((signature) => signature.docletUid === constructor.uid)
      .map((signature) => signature.uid);
    expect(constructorSignatureIds.length).toBeGreaterThan(0);
    expect(
      publication.dataset.returns.filter((entry) =>
        constructorSignatureIds.includes(entry.signatureUid)
      )
    ).toEqual([]);

    const widgetPage = publication.pages.find(
      (page) => page.kind === "component"
    )!;
    const widgetSections = publication.sections
      .filter((section) => section.pageUid === widgetPage.uid)
      .sort((a, b) => a.order - b.order);
    expect(widgetSections.map((section) => section.kind)).toEqual([
      "markdown",
      "signature",
      "component-properties",
      "component-events",
      "members",
      "source",
    ]);

    const layouts = publication.layouts.map((layout) => layout.name).sort();
    expect(layouts).toEqual([
      "docs.layout.class",
      "docs.layout.component",
      "docs.layout.home",
      "docs.layout.interface",
      "docs.layout.page",
      "docs.layout.source",
      "docs.layout.tutorial",
    ]);
    for (const page of publication.pages) {
      expect(publication.layouts.some((layout) => layout.uid === page.layoutId)).toBe(
        true
      );
    }

    const navigation = publication.navigation;
    expect(navigation[0]).toMatchObject({
      label: "Documentation",
      kind: "root",
    });
    const adaptersIndex = navigation.findIndex(
      (item) => item.label === "Adapters" && item.kind === "category"
    );
    const componentsIndex = navigation.findIndex(
      (item) => item.label === "Components" && item.kind === "category"
    );
    expect(adaptersIndex).toBeGreaterThan(-1);
    expect(componentsIndex).toBeGreaterThan(adaptersIndex);
    expect(navigation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Memory",
          kind: "subcategory",
        }),
        expect.objectContaining({
          label: "RamAdapter",
          kind: "class",
          docletUid: ram.uid,
          pageUid: ramPage.uid,
        }),
      ])
    );

    const canonicalNavigationUid = DocsIds.navigation("main");
    for (const page of publication.pages) {
      expect(page.navigationUid).toBe(canonicalNavigationUid);
    }
    for (const item of navigation) {
      expect(item.navigationUid).toBe(canonicalNavigationUid);
      expect(item.uid.startsWith("navigation-item:main:")).toBe(true);
      if (!item.pageUid) continue;
      const page = publication.pages.find(
        (candidate) => candidate.uid === item.pageUid
      );
      expect(page).toBeDefined();
      expect(item.navigationUid).toBe(page!.navigationUid);
    }

    expect(result.search.length).toBe(publication.search.length);
    for (let index = 1; index < result.search.length; index += 1) {
      expect(result.search[index - 1].rank).toBeGreaterThanOrEqual(
        result.search[index].rank
      );
    }
    expect(result.search[0]).toMatchObject({
      kind: "component",
      name: "DocWidgetComponent",
      rank: 9,
    });
    const readEntry = result.search.find(
      (entry) => entry.docletUid === read.uid
    )!;
    expect(readEntry).toMatchObject({
      kind: "function",
      route: "/docs/classes/RamAdapter",
      anchor: "read",
      rank: 6,
    });
    expect(readEntry.tokens).toEqual(
      expect.arrayContaining(["read", "key", "string", "unknown"])
    );

    expect(result.manifest).toMatchObject({
      projectName: PROJECT.name,
      projectVersion: PROJECT.version,
      buildId: "build-one",
      sourceRevision: "rev-1",
      generator: `${PROJECT.name}@${PROJECT.version}`,
      counts: publication.counts,
    });
    expect(result.manifest.tableNames).toEqual([...DocsTableNames]);

    expect(result.snapshot).toMatchObject({
      schemaVersion: 1,
      project: PROJECT,
      build: { id: "build-one", sourceRevision: "rev-1" },
    });
    const snapshotCounts = Object.fromEntries(
      Object.entries(result.snapshot.tables).map(([name, records]) => [
        name,
        records.length,
      ])
    );
    expect(snapshotCounts).toEqual({
      doclets: 11,
      tags: 15,
      types: 9,
      parameters: 2,
      returns: 1,
      signatures: 4,
      examples: 0,
      sources: 11,
      references: 1,
      components: 1,
      componentProperties: 2,
      componentEvents: 1,
      componentPreviews: 0,
      tutorials: 0,
      pages: 5,
      sections: 15,
      routes: 5,
      links: 11,
      navigation: 14,
      search: 11,
      lookups: 0,
      layouts: 7,
      manifests: 1,
    });
  });

  it("repeats extraction and publication without changing the snapshot", async () => {
    const firstDatabase = new DocsDatabase();
    const secondDatabase = new DocsDatabase();
    const firstCompiler = compilerFor(firstDatabase);
    const secondCompiler = compilerFor(secondDatabase);

    const first = await firstCompiler.build(firstDatabase);
    const second = await secondCompiler.build(secondDatabase);
    const repeated = await firstCompiler.build(firstDatabase);

    expect(stableStringify(second.snapshot)).toBe(
      stableStringify(first.snapshot)
    );
    expect(stableStringify(repeated.snapshot)).toBe(
      stableStringify(first.snapshot)
    );
    expect(repeated.publication.counts).toEqual(first.publication.counts);
    expect(repeated.pages.map((page) => page.route)).toEqual(
      first.pages.map((page) => page.route)
    );
  });

  it("publishes configured tutorials with pages, sections, links and search entries", async () => {
    const database = new DocsDatabase();
    const compiler = compilerFor(database, {
      basePath: "/manual",
      tutorials: [
        {
          name: "guide",
          title: "Getting Started",
          content: "# Getting Started\nWelcome.",
        },
        {
          name: "advanced",
          title: "Advanced Guide",
          parentName: "guide",
          content: "# Advanced\nDetails.",
        },
        {
          name: "orphan",
          title: "Orphan Guide",
          content: "# Orphan\nNo doclet references this tutorial.",
        },
      ],
    });

    const extraction = await compiler.extract(database);
    const ram = docletNamed(extraction.doclets, "RamAdapter");
    const base = docletNamed(extraction.doclets, "BaseAdapter", "interface");
    await database.tags.create(
      new DocTagModel({
        uid: "tag:tutorial:guide",
        ownerUid: ram.uid,
        name: "tutorial",
        value: "guide",
      })
    );
    await database.tags.create(
      new DocTagModel({
        uid: "tag:tutorial:advanced",
        ownerUid: base.uid,
        name: "tutorial",
        value: "advanced",
      })
    );

    const publication = await compiler.publish(database);
    const guide = publication.tutorials.find(
      (tutorial) => tutorial.name === "guide"
    )!;
    const advanced = publication.tutorials.find(
      (tutorial) => tutorial.name === "advanced"
    )!;

    expect(guide).toMatchObject({
      title: "Getting Started",
      route: "/manual/tutorials/guide",
      pageUid: "page:tutorial:guide",
    });
    expect(advanced).toMatchObject({
      title: "Advanced Guide",
      route: "/manual/tutorials/advanced",
      parentUid: guide.uid,
    });
    expect(guide.childUids).toContain(advanced.uid);
    expect(guide.docletUids).toContain(ram.uid);
    expect(advanced.docletUids).toContain(base.uid);

    const guidePage = publication.pages.find(
      (page) => page.uid === guide.pageUid
    )!;
    const advancedPage = publication.pages.find(
      (page) => page.uid === advanced.pageUid
    )!;
    expect(guidePage).toMatchObject({
      kind: "tutorial",
      route: "/manual/tutorials/guide",
      layoutId: "layout:docs.layout.tutorial",
      tutorialUids: [guide.uid],
      docletUids: [ram.uid],
    });
    expect(advancedPage.tutorialUids).toEqual([advanced.uid]);
    const guideSections = publication.sections.filter(
      (section) => section.pageUid === guidePage.uid
    );
    expect(guideSections).toEqual([
      expect.objectContaining({
        kind: "markdown",
        title: "Getting Started",
        content: "# Getting Started\nWelcome.",
        docletUids: [ram.uid],
      }),
    ]);
    expect(publication.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: "/manual/tutorials/guide",
          pageUid: guidePage.uid,
          kind: "tutorial",
        }),
        expect.objectContaining({
          route: "/manual/tutorials/advanced",
          pageUid: advancedPage.uid,
          kind: "tutorial",
        }),
      ])
    );

    const tutorialsGroup = publication.navigation.find(
      (item) => item.kind === "group" && item.label === "Tutorials"
    )!;
    const guideNavigation = publication.navigation.find(
      (item) => item.kind === "tutorial" && item.label === "Getting Started"
    )!;
    expect(tutorialsGroup).toBeDefined();
    expect(guideNavigation).toMatchObject({
      route: "/manual/tutorials/guide",
      pageUid: guidePage.uid,
    });
    expect(publication.navigation.indexOf(guideNavigation)).toBeGreaterThan(
      publication.navigation.indexOf(tutorialsGroup)
    );
    expect(
      publication.navigation.indexOf(tutorialsGroup)
    ).toBeLessThan(
      publication.navigation.findIndex(
        (item) => item.label === "Adapters" && item.kind === "category"
      )
    );

    const guideSearch = publication.search.find(
      (entry) => entry.kind === "tutorial" && entry.name === "guide"
    )!;
    const advancedSearch = publication.search.find(
      (entry) => entry.kind === "tutorial" && entry.name === "advanced"
    )!;
    expect(guideSearch).toMatchObject({
      route: "/manual/tutorials/guide",
      rank: 6,
    });
    expect(guideSearch.tokens).toEqual(
      expect.arrayContaining(["getting", "started", "welcome"])
    );
    expect(advancedSearch).toMatchObject({
      route: "/manual/tutorials/advanced",
      rank: 6,
    });

    const orphan = publication.tutorials.find(
      (tutorial) => tutorial.name === "orphan"
    )!;
    expect(orphan).toBeDefined();
    expect(orphan.docletUids).toEqual([]);
    const orphanSearch = publication.search.find(
      (entry) => entry.kind === "tutorial" && entry.name === "orphan"
    )!;
    expect(orphanSearch).toBeDefined();
    expect(orphanSearch.docletUid).toBeUndefined();
    expect(orphanSearch).toMatchObject({
      route: "/manual/tutorials/orphan",
      rank: 6,
    });
  });

  it("keeps HTML, BetterDocs, JSDoc and TAFFY out of the runtime dependency graph", () => {
    const root = path.resolve(__dirname, "../..");
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8")
    );
    const banned = ["better-docs", "jsdoc", "taffy", "html"];
    const matches = (name: string): boolean =>
      banned.some(
        (marker) => name === marker || name.startsWith(`${marker}-`) || name.startsWith(`${marker}/`)
      );

    expect(Object.keys(packageJson.dependencies).filter(matches)).toEqual([]);

    const files: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const child = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(child);
        else if (/\.tsx?$/.test(entry.name)) files.push(child);
      }
    };
    walk(path.join(root, "src"));

    const imports = new Set<string>();
    const importPattern =
      /(?:from\s+|require\(\s*|import\(\s*)["']([^"']+)["']/g;
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(importPattern))
        imports.add(match[1]);
    }

    expect([...imports].filter(matches)).toEqual([]);
    expect([...imports].some((name) => name === "typescript")).toBe(true);
  });
});
