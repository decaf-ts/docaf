import { Metadata } from "@decaf-ts/decoration";
import { DocsDatabase } from "../../src/database/DocsDatabase";
import { DocumentationCompiler } from "../../src/generator/compiler/DocumentationCompiler";
import { DocsIds } from "../../src/models";
import {
  DocsElements,
  DocsBodyLayout,
  DocsClassLayout,
  DocsComponentLayout,
  DocsPageService,
  DocsSiteLayout,
} from "../../src/ui";
import {
  DocsTables,
  exportDocsSnapshot,
  hydrateDocsDatabase,
  stableStringify,
  type DocsSnapshotV1,
} from "../../src/snapshot";
import { VERTICAL_SLICE } from "../unit/support/typescript";

const PROJECT = { name: "@fixture/adapter", version: "1.0.0" };

function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

async function sliceDatabase(): Promise<{
  database: DocsDatabase;
  snapshot: DocsSnapshotV1;
}> {
  const database = new DocsDatabase();
  const compiler = new DocumentationCompiler({
    project: PROJECT,
    rootNames: [VERTICAL_SLICE],
    database,
    snapshot: { id: "roundtrip-slice", sourceRevision: "local" },
  });
  await compiler.build(database);
  return { database, snapshot: await exportDocsSnapshot(database) };
}

describe("docs layout snapshot round-trip", () => {
  it("preserves the resolved site layout through snapshot serialization and hydration", async () => {
    const { database, snapshot } = await sliceDatabase();
    const service = new DocsPageService(database);
    const original = await service.resolveLayout("/docs/classes/RamAdapter");

    const serialized = JSON.parse(JSON.stringify(snapshot)) as DocsSnapshotV1;
    expect(stableStringify(serialized)).toBe(stableStringify(snapshot));

    const target = new DocsDatabase();
    await target.initialize();
    await hydrateDocsDatabase(target, serialized);
    const rehydrated = await new DocsPageService(target).resolveLayout(
      "/docs/classes/RamAdapter"
    );

    expect(rehydrated).toBeInstanceOf(DocsSiteLayout);
    expect(rehydrated.body).toBeInstanceOf(DocsBodyLayout);
    expect(rehydrated.body.content).toBeInstanceOf(DocsClassLayout);
    expect(plain(rehydrated)).toEqual(plain(original));
    expect(stableStringify(plain(rehydrated))).toBe(
      stableStringify(plain(original))
    );
  });

  it("preserves the component page layout and preview controls through hydration", async () => {
    const { database, snapshot } = await sliceDatabase();
    const original = await new DocsPageService(database).resolveLayout(
      "/docs/components/DocWidgetComponent"
    );

    const target = new DocsDatabase();
    await target.initialize();
    await hydrateDocsDatabase(target, snapshot);
    const rehydrated = await new DocsPageService(target).resolveLayout(
      "/docs/components/DocWidgetComponent"
    );

    expect(rehydrated.body.content).toBeInstanceOf(DocsComponentLayout);
    expect(plain(rehydrated)).toEqual(plain(original));
    const preview = (rehydrated.body.content as DocsComponentLayout).preview;
    expect(preview.preview).toMatchObject({
      framework: "angular",
      kind: "native",
      events: ["changed"],
    });
    expect(preview.preview.controls.map((control) => control.name)).toEqual([
      "count",
      "label",
    ]);
  });

  it("re-resolves nested layout metadata from the reconstructed model classes", async () => {
    const { snapshot } = await sliceDatabase();
    const target = new DocsDatabase();
    await target.initialize();
    await hydrateDocsDatabase(target, snapshot);
    const layout = await new DocsPageService(target).resolveLayout(
      "/docs/classes/RamAdapter"
    );

    const site = Metadata.get(DocsSiteLayout) as {
      ui: {
        uilayout: { cols: number; rows: number };
        properties: Record<
          string,
          { uichild: { tag: string; props: Record<string, unknown> } }
        >;
      };
    };
    const body = Metadata.get(DocsBodyLayout) as {
      ui: {
        uilayout: { cols: number; rows: number; gap?: string };
        properties: Record<string, { uichild: { tag: string } }>;
      };
    };

    expect(layout.pageUid).toBe(
      DocsIds.page(DocsIds.doclet(PROJECT.name, "RamAdapter"))
    );
    expect(site.ui.properties.body.uichild.tag).toBe(DocsElements.BODY_LAYOUT);
    expect(site.ui.properties.header.uichild.tag).toBe(DocsElements.HEADER);
    expect(site.ui.properties.footer.uichild.tag).toBe(DocsElements.FOOTER);
    expect(body.ui.uilayout).toMatchObject({ cols: 3, rows: 1, gap: "small" });
    expect(body.ui.properties.sidebar.uichild.tag).toBe(DocsElements.SIDEBAR);
    expect(body.ui.properties.content.uichild.tag).toBe(
      DocsElements.PAGE_LAYOUT
    );
    expect(body.ui.properties.toc.uichild.tag).toBe(DocsElements.TOC);
    expect(layout.body.sidebar.items.length).toBeGreaterThan(0);
    expect(layout.body.toc.items.length).toBeGreaterThan(0);
  });

  it("round-trips every docs table and re-hydrates idempotently", async () => {
    const { snapshot } = await sliceDatabase();
    const target = new DocsDatabase();
    await target.initialize();
    await hydrateDocsDatabase(target, snapshot);
    const first = await exportDocsSnapshot(target);
    await hydrateDocsDatabase(target, first);
    const second = await exportDocsSnapshot(target);

    expect(stableStringify(second)).toBe(stableStringify(first));
    for (const table of DocsTables) {
      const originalRecords = snapshot.tables[table.name];
      const rehydratedRecords = second.tables[table.name];
      expect(rehydratedRecords.map((record) => record.uid)).toEqual(
        originalRecords.map((record) => record.uid)
      );
    }
  });
});
