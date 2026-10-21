import { InternalError } from "@decaf-ts/db-decorators";
import type { Repository } from "@decaf-ts/core";
import type { RamAdapter } from "@decaf-ts/core/ram";
import type { DocsDatabase } from "../database/DocsDatabase";
import {
  DocLayoutModel,
  DocLinkModel,
  DocManifestModel,
  DocNavigationItemModel,
  DocPageModel,
  DocRouteModel,
  DocSearchEntryModel,
  DocSectionModel,
  DocsIds,
  type DocsModel,
} from "../models";
import { DocsTables, type DocsTableName } from "../snapshot";
import { loadPublicationDataset, type PublicationDataset } from "./dataset";
import { DocletPruner, type DocletPrunerOptions } from "./DocletPruner";
import { DocletSorter } from "./DocletSorter";
import { LinkRegistry, type LinkRouting } from "./LinkRegistry";
import { ModuleResolver } from "./ModuleResolver";
import {
  NAV_GROUP_ORDER,
  NavigationBuilder,
  type TutorialNavigationEntry,
} from "./NavigationBuilder";
import { PageBuilder } from "./PageBuilder";
import { PreviewBuilder } from "./PreviewBuilder";
import { SearchIndexBuilder } from "./SearchIndexBuilder";
import { SignatureBuilder } from "./SignatureBuilder";
import { SourcePublisher } from "./SourcePublisher";
import {
  TutorialBuilder,
  type TutorialBuilderOptions,
  type TutorialDefinition,
} from "./TutorialBuilder";

/**
 * @description Configuration for the DecafPublisher orchestration.
 * @summary Only `packageName` is required; it feeds the ModuleResolver when
 * qualifying inherited and implemented members. `projectName`, `projectVersion`,
 * `sourceRevision` and `buildId` populate the manifest (defaulting to
 * "docaf", "0.0.0" and, when no build id is given, the source revision or
 * "local"). `basePath` prefixes every generated route, `routing` selects hash
 * vs history link rendering, and `navigationUid` names the navigation tree
 * (defaulting to "main"). `useLongnameInNav` renders longnames instead of
 * bare names in the sidebar, `includePrivate` and `includeUndocumented`
 * control what the DocletPruner keeps, and `tutorials` supplies the
 * TutorialDefinition records merged into the dataset.
 */
export interface DecafPublisherOptions {
  packageName: string;
  projectName?: string;
  projectVersion?: string;
  sourceRevision?: string;
  buildId?: string;
  basePath?: string;
  routing?: LinkRouting;
  navigationUid?: string;
  useLongnameInNav?: boolean;
  includePrivate?: boolean;
  includeUndocumented?: boolean;
  tutorials?: readonly TutorialDefinition[];
}

/**
 * @description Complete output of a publication run.
 * @summary Groups the (mutated) source PublicationDataset together with every
 * derived model collection produced by the pipeline: pages, sections,
 * tutorials, routes, links, navigation items, search entries, layouts and the
 * single manifest. `counts` is the manifest's per-table record count map, and
 * all collections are the exact instances persisted to the DocsDatabase.
 */
export interface PublicationResult {
  dataset: PublicationDataset;
  pages: DocPageModel[];
  sections: DocSectionModel[];
  tutorials: PublicationDataset["tutorials"];
  routes: DocRouteModel[];
  links: DocLinkModel[];
  navigation: DocNavigationItemModel[];
  search: DocSearchEntryModel[];
  layouts: DocLayoutModel[];
  manifest: DocManifestModel;
  counts: Record<string, number>;
}

/**
 * @description Coordinates the deterministic publication order.
 * @summary Runs prune -> sort -> sources -> signatures -> modules -> links -> tutorials ->
 * navigation -> pages -> search -> persist over the docs database (or a pre-loaded dataset).
 * @class DecafPublisher
 */
export class DecafPublisher {
  readonly options: DecafPublisherOptions;

  constructor(options: DecafPublisherOptions) {
    this.options = options;
  }

  async publish(
    database: DocsDatabase,
    dataset?: PublicationDataset
  ): Promise<PublicationResult> {
    const source = dataset ?? (await loadPublicationDataset(database));
    return this.publishDataset(database, source);
  }

  async publishDataset(
    database: DocsDatabase,
    dataset: PublicationDataset
  ): Promise<PublicationResult> {
    this.prune(dataset);
    dataset.doclets = new DocletSorter().sort(dataset.doclets);
    new SourcePublisher().process(dataset);
    new SignatureBuilder().process(dataset);
    new PreviewBuilder().process(dataset);

    const links = new LinkRegistry({
      basePath: this.options.basePath,
      routing: this.options.routing,
    });
    const moduleResolver = new ModuleResolver({
      packageName: this.options.packageName,
    });
    moduleResolver.resolve(dataset);
    const registration = links.register(dataset.doclets);
    moduleResolver.resolveLinks(dataset, links);

    const tutorials = new TutorialBuilder(
      this.tutorialOptions()
    ).build(dataset);

    const navigation = new NavigationBuilder({
      links,
      useLongnameInNav: this.options.useLongnameInNav,
      includePrivate: this.options.includePrivate,
    }).buildNav(
      dataset.doclets,
      NAV_GROUP_ORDER,
      this.options.navigationUid ?? "main",
      tutorials.map(
        (tutorial): TutorialNavigationEntry => ({
          uid: tutorial.uid,
          name: tutorial.name,
          title: tutorial.title,
          route: tutorial.route,
        })
      )
    );

    const pagePublication = new PageBuilder({
      basePath: this.options.basePath,
      navigationUid: this.options.navigationUid,
    }).build(dataset, links);

    this.ensurePageRoutes(pagePublication.pages, registration.routes);

    for (const item of navigation) {
      if (item.docletUid) {
        const doclet = dataset.doclets.find(
          (candidate) => candidate.uid === item.docletUid
        );
        if (doclet)
          item.pageUid = links.resolve(doclet.longname)?.pageUid;
      }
      const tutorial = tutorials.find(
        (candidate) =>
          candidate.uid === item.docletUid ||
          (Boolean(item.route) && candidate.route === item.route)
      );
      if (tutorial) item.pageUid = tutorial.pageUid;
    }

    const search = new SearchIndexBuilder().build(dataset, links);
    const counts = this.counts(
      dataset,
      pagePublication,
      registration.routes,
      registration.links,
      navigation,
      search
    );
    const manifest = this.manifest(counts);

    const result: PublicationResult = {
      dataset,
      pages: pagePublication.pages,
      sections: pagePublication.sections,
      tutorials: dataset.tutorials,
      routes: registration.routes,
      links: registration.links,
      navigation,
      search,
      layouts: pagePublication.layouts,
      manifest,
      counts,
    };

    await this.persist(database, result);
    return result;
  }

  private prune(dataset: PublicationDataset): void {
    const options: DocletPrunerOptions = {
      includePrivate: this.options.includePrivate,
      includeUndocumented: this.options.includeUndocumented,
    };
    const kept = new DocletPruner(options).prune(dataset.doclets);
    const removed = new Set(
      dataset.doclets
        .filter((doclet) => !kept.includes(doclet))
        .map((doclet) => doclet.uid)
    );
    if (!removed.size) return;
    const retains = (uid: string): boolean => !removed.has(uid);
    dataset.doclets = kept;
    for (const key of [
      "tags",
      "types",
      "parameters",
      "returns",
      "signatures",
      "examples",
      "sources",
      "references",
    ] as const) {
      dataset[key] = (dataset[key] as { ownerUid?: string }[]).filter(
        (model) => !model.ownerUid || retains(model.ownerUid)
      ) as never;
    }
    const orphanSignatures = new Set(
      dataset.signatures
        .filter((signature) => !retains(signature.docletUid))
        .map((signature) => signature.uid)
    );
    if (orphanSignatures.size) {
      dataset.signatures = dataset.signatures.filter(
        (signature) => !orphanSignatures.has(signature.uid)
      );
      dataset.parameters = dataset.parameters.filter(
        (parameter) =>
          !parameter.signatureUid ||
          !orphanSignatures.has(parameter.signatureUid)
      );
      dataset.returns = dataset.returns.filter(
        (returns) =>
          !returns.signatureUid ||
          !orphanSignatures.has(returns.signatureUid)
      );
    }
    dataset.componentProperties = dataset.componentProperties.filter(
      (property) =>
        !property.componentUid ||
        dataset.components.some(
          (component) => component.uid === property.componentUid
        )
    );
    dataset.componentEvents = dataset.componentEvents.filter(
      (event) =>
        !event.componentUid ||
        dataset.components.some(
          (component) => component.uid === event.componentUid
        )
    );
  }

  private ensurePageRoutes(
    pages: readonly DocPageModel[],
    routes: DocRouteModel[]
  ): void {
    const known = new Set(routes.map((route) => route.route));
    for (const page of pages) {
      if (known.has(page.route)) continue;
      known.add(page.route);
      routes.push(
        new DocRouteModel({
          uid: DocsIds.route(page.route),
          route: page.route,
          pageUid: page.uid,
          kind: page.kind,
          name: page.title,
        })
      );
    }
    routes.sort((a, b) => a.route.localeCompare(b.route));
  }

  private tutorialOptions(): TutorialBuilderOptions {
    return {
      basePath: this.options.basePath,
      tutorials: this.options.tutorials,
    };
  }

  private manifest(counts: Record<string, number>): DocManifestModel {
    const projectName = this.options.projectName ?? "docaf";
    const projectVersion = this.options.projectVersion ?? "0.0.0";
    const sourceRevision = this.options.sourceRevision ?? "";
    const buildId = this.options.buildId ?? (sourceRevision || "local");
    return new DocManifestModel({
      uid: DocsIds.manifest(projectName, buildId),
      schemaVersion: 1,
      projectName,
      projectVersion,
      buildId,
      sourceRevision,
      generator: `${projectName}@${projectVersion}`,
      tableNames: DocsTables.map((table) => table.name),
      counts,
    });
  }

  private counts(
    dataset: PublicationDataset,
    publication: {
      pages: DocPageModel[];
      sections: DocSectionModel[];
      layouts: DocLayoutModel[];
    },
    routes: DocRouteModel[],
    links: DocLinkModel[],
    navigation: DocNavigationItemModel[],
    search: DocSearchEntryModel[]
  ): Record<string, number> {
    return {
      doclets: dataset.doclets.length,
      tags: dataset.tags.length,
      types: dataset.types.length,
      parameters: dataset.parameters.length,
      returns: dataset.returns.length,
      signatures: dataset.signatures.length,
      examples: dataset.examples.length,
      sources: dataset.sources.length,
      references: dataset.references.length,
      components: dataset.components.length,
      componentProperties: dataset.componentProperties.length,
      componentEvents: dataset.componentEvents.length,
      componentPreviews: dataset.componentPreviews.length,
      tutorials: dataset.tutorials.length,
      pages: publication.pages.length,
      sections: publication.sections.length,
      routes: routes.length,
      links: links.length,
      navigation: navigation.length,
      search: search.length,
      layouts: publication.layouts.length,
      manifests: 1,
    };
  }

  private async persist(
    database: DocsDatabase,
    result: PublicationResult
  ): Promise<void> {
    await database.initialize();
    const repositories = database.repositories();
    for (const table of DocsTables) {
      const repository = repositories[table.name] as Repository<
        DocsModel,
        RamAdapter
      >;
      const existing = await repository.select().execute();
      if (existing.length)
        await repository.deleteAll(
          existing.map((model) => String((model as DocsModel).uid))
        );
    }

    const dataset = result.dataset;
    const writes: Array<[DocsTableName, unknown[]]> = [
      ["doclets", dataset.doclets],
      ["tags", dataset.tags],
      ["types", dataset.types],
      ["parameters", dataset.parameters],
      ["returns", dataset.returns],
      ["signatures", dataset.signatures],
      ["examples", dataset.examples],
      ["sources", dataset.sources],
      ["references", dataset.references],
      ["components", dataset.components],
      ["componentProperties", dataset.componentProperties],
      ["componentEvents", dataset.componentEvents],
      ["componentPreviews", dataset.componentPreviews],
      ["tutorials", dataset.tutorials],
      ["pages", result.pages],
      ["sections", result.sections],
      ["routes", result.routes],
      ["links", result.links],
      ["navigation", result.navigation],
      ["search", result.search],
      ["layouts", result.layouts],
      ["manifests", [result.manifest]],
    ];
    for (const [table, models] of writes) {
      if (!models.length) continue;
      const repository = repositories[table] as Repository<
        DocsModel,
        RamAdapter
      >;
      await repository.createAll(models as DocsModel[]);
    }

    const missing = DocsTables.find(
      (table) => !(table.name in repositories)
    );
    if (missing)
      throw new InternalError(
        `Missing docs repository for "${missing.name}"`
      );
  }
}
