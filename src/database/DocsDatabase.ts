import { Adapter, Repository } from "@decaf-ts/core";
import { RamAdapter, type RamConfig } from "@decaf-ts/core/ram";
import { ConflictError } from "@decaf-ts/db-decorators";
import {
  DocComponentEventModel,
  DocComponentModel,
  DocComponentPreviewModel,
  DocComponentPropertyModel,
  DocExampleModel,
  DocLayoutModel,
  DocLinkModel,
  DocLookupModel,
  DocManifestModel,
  DocNavigationItemModel,
  DocPageModel,
  DocParameterModel,
  DocReferenceModel,
  DocReturnModel,
  DocRouteModel,
  DocSearchEntryModel,
  DocSectionModel,
  DocSignatureModel,
  DocSourceModel,
  DocTagModel,
  DocTutorialModel,
  DocTypeModel,
  DocletModel,
  type DocsModel,
} from "../models";
import type { DocsTableName } from "../snapshot/records";

/**
 * @description Construction options for `DocsDatabase`.
 * @summary All fields optional: `alias` names the registered `RamAdapter` (a sequential
 * `decaf-docs-N` alias is generated when omitted), and `config` is passed through to the
 * adapter's `RamConfig`.
 */
export interface DocsDatabaseOptions {
  alias?: string;
  config?: RamConfig;
}

/**
 * @description In-memory docs database facade built on the Decaf `RamAdapter`.
 * @summary Owns one `RamAdapter` and exposes a typed `Repository` per docs table (doclets, tags,
 * types, signatures, pages, navigation, search, ...). The alias defaults to a sequential
 * `decaf-docs-N` and must not already be registered, otherwise a `ConflictError` is thrown;
 * passing a bare string sets the alias. Initialization is idempotent and required before the
 * repositories are usable. Used by snapshot export/hydration and the runtime/services facades.
 * @example
 * const database = new DocsDatabase({ alias: "docs" });
 * await database.initialize();
 * const doclets = await database.doclets.select().execute();
 * @class DocsDatabase
 */
export class DocsDatabase {
  private static aliasSequence = 0;

  readonly adapter: RamAdapter;
  readonly alias: string;
  readonly doclets: Repository<DocletModel, RamAdapter>;
  readonly tags: Repository<DocTagModel, RamAdapter>;
  readonly types: Repository<DocTypeModel, RamAdapter>;
  readonly parameters: Repository<DocParameterModel, RamAdapter>;
  readonly returns: Repository<DocReturnModel, RamAdapter>;
  readonly signatures: Repository<DocSignatureModel, RamAdapter>;
  readonly examples: Repository<DocExampleModel, RamAdapter>;
  readonly sources: Repository<DocSourceModel, RamAdapter>;
  readonly references: Repository<DocReferenceModel, RamAdapter>;
  readonly components: Repository<DocComponentModel, RamAdapter>;
  readonly componentProperties: Repository<
    DocComponentPropertyModel,
    RamAdapter
  >;
  readonly componentEvents: Repository<DocComponentEventModel, RamAdapter>;
  readonly componentPreviews: Repository<DocComponentPreviewModel, RamAdapter>;
  readonly tutorials: Repository<DocTutorialModel, RamAdapter>;
  readonly pages: Repository<DocPageModel, RamAdapter>;
  readonly sections: Repository<DocSectionModel, RamAdapter>;
  readonly routes: Repository<DocRouteModel, RamAdapter>;
  readonly links: Repository<DocLinkModel, RamAdapter>;
  readonly navigation: Repository<DocNavigationItemModel, RamAdapter>;
  readonly search: Repository<DocSearchEntryModel, RamAdapter>;
  readonly lookups: Repository<DocLookupModel, RamAdapter>;
  readonly layouts: Repository<DocLayoutModel, RamAdapter>;
  readonly manifests: Repository<DocManifestModel, RamAdapter>;

  private initialized = false;

  static nextAlias(prefix = "decaf-docs"): string {
    DocsDatabase.aliasSequence += 1;
    return `${prefix}-${DocsDatabase.aliasSequence}`;
  }

  static isAliasRegistered(alias: string): boolean {
    try {
      Adapter.get(alias);
      return true;
    } catch {
      return false;
    }
  }

  constructor(options: DocsDatabaseOptions | string = {}) {
    const config = typeof options === "string" ? {} : options;
    const alias = (typeof options === "string" ? options : options.alias) ??
      DocsDatabase.nextAlias();
    if (DocsDatabase.isAliasRegistered(alias))
      throw new ConflictError(`Docs database alias "${alias}" is already registered`);
    this.alias = alias;
    this.adapter = new RamAdapter(config.config, alias);
    this.doclets = new Repository(this.adapter, DocletModel);
    this.tags = new Repository(this.adapter, DocTagModel);
    this.types = new Repository(this.adapter, DocTypeModel);
    this.parameters = new Repository(this.adapter, DocParameterModel);
    this.returns = new Repository(this.adapter, DocReturnModel);
    this.signatures = new Repository(this.adapter, DocSignatureModel);
    this.examples = new Repository(this.adapter, DocExampleModel);
    this.sources = new Repository(this.adapter, DocSourceModel);
    this.references = new Repository(this.adapter, DocReferenceModel);
    this.components = new Repository(this.adapter, DocComponentModel);
    this.componentProperties = new Repository(
      this.adapter,
      DocComponentPropertyModel
    );
    this.componentEvents = new Repository(
      this.adapter,
      DocComponentEventModel
    );
    this.componentPreviews = new Repository(
      this.adapter,
      DocComponentPreviewModel
    );
    this.tutorials = new Repository(this.adapter, DocTutorialModel);
    this.pages = new Repository(this.adapter, DocPageModel);
    this.sections = new Repository(this.adapter, DocSectionModel);
    this.routes = new Repository(this.adapter, DocRouteModel);
    this.links = new Repository(this.adapter, DocLinkModel);
    this.navigation = new Repository(this.adapter, DocNavigationItemModel);
    this.search = new Repository(this.adapter, DocSearchEntryModel);
    this.lookups = new Repository(this.adapter, DocLookupModel);
    this.layouts = new Repository(this.adapter, DocLayoutModel);
    this.manifests = new Repository(this.adapter, DocManifestModel);
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.adapter.initialize();
    this.initialized = true;
  }

  repositories(): Record<
    DocsTableName,
    Repository<DocsModel, RamAdapter>
  > {
    return {
      doclets: this.doclets,
      tags: this.tags,
      types: this.types,
      parameters: this.parameters,
      returns: this.returns,
      signatures: this.signatures,
      examples: this.examples,
      sources: this.sources,
      references: this.references,
      components: this.components,
      componentProperties: this.componentProperties,
      componentEvents: this.componentEvents,
      componentPreviews: this.componentPreviews,
      tutorials: this.tutorials,
      pages: this.pages,
      sections: this.sections,
      routes: this.routes,
      links: this.links,
      navigation: this.navigation,
      search: this.search,
      lookups: this.lookups,
      layouts: this.layouts,
      manifests: this.manifests,
    } as Record<DocsTableName, Repository<DocsModel, RamAdapter>>;
  }
}
