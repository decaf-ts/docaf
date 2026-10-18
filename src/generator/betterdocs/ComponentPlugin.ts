import ts from "typescript";
import type { DocletModel } from "../../models";
import type { GeneratedDocsStore } from "../store";
import type {
  ComponentExtractor,
  DecafDocsPlugin,
  DocsSourceContext,
} from "../types";
import type { TagResolver } from "./CategoryPlugin";

/**
 * @description Configuration for the BetterDocs `@component` plugin.
 * @summary Carries the store into which extracted component records are
 * written, the list of framework-specific extractors to choose from, and the
 * tag resolver used to detect `@component` annotations on doclets.
 */
export interface ComponentPluginOptions {
  /**
   * Store where the component, its properties and its events are registered.
   */
  store: GeneratedDocsStore;
  extractors: readonly ComponentExtractor[];
  /**
   * Resolver returning the doclet tags to scan for `@component`.
   */
  resolveTags: TagResolver;
}

function findClass(
  doclet: DocletModel,
  source: DocsSourceContext
): ts.Declaration | undefined {
  const known = source.declarations?.get(doclet.longname);
  if (known) return known;
  for (const statement of source.sourceFile.statements) {
    if (!ts.isClassDeclaration(statement) || !statement.name) continue;
    if (statement.name.text === doclet.name) return statement;
  }
  return undefined;
}

/**
 * Port of BetterDocs `component.js`. The extractor is selected from the
 * documented component's framework, never from the documentation renderer.
 */
export class ComponentPlugin implements DecafDocsPlugin {
  readonly name = "component";

  constructor(private readonly options: ComponentPluginOptions) {}

  async newDoclet(
    doclet: DocletModel,
    source: DocsSourceContext
  ): Promise<void> {
    const tags = this.options.resolveTags(doclet);
    if (!tags.some((tag) => tag.name === "component")) return;

    const declaration = findClass(doclet, source);
    if (!declaration) {
      source.diagnostics.error(
        "DOCAF_COMPONENT_DECLARATION_MISSING",
        `Cannot find the declaration documented by ${doclet.longname}`
      );
      return;
    }

    const extractor = this.options.extractors.find((candidate) =>
      candidate.supports(declaration, source)
    );
    if (!extractor) {
      source.diagnostics.error(
        "DOCAF_COMPONENT_EXTRACTOR_MISSING",
        `No component extractor supports ${doclet.longname}`
      );
      return;
    }

    const extracted = await extractor.extract(declaration, source);
    const component = extracted.component;
    if (!component) {
      source.diagnostics.error(
        "DOCAF_COMPONENT_EXTRACTION_EMPTY",
        `Component extractor "${extractor.framework}" returned no component for ${doclet.longname}`
      );
      return;
    }

    component.docletUid = doclet.uid;
    component.propertyUids = extracted.properties.map(
      (property) => property.uid
    );
    component.eventUids = extracted.events.map((event) => event.uid);
    this.options.store.add("components", component);
    for (const property of extracted.properties) {
      property.componentUid = component.uid;
      this.options.store.add("componentProperties", property);
    }
    for (const event of extracted.events) {
      event.componentUid = component.uid;
      this.options.store.add("componentEvents", event);
    }

    doclet.componentId = component.uid;
    doclet.kind = "class";
    doclet.metadata = {
      ...(doclet.metadata ?? {}),
      component: "true",
      componentFramework: extracted.framework,
    };
    this.options.store.add("doclets", doclet);
  }
}
