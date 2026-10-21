import "@decaf-ts/core";
import { Model } from "@decaf-ts/decorator-validation";
import { DocComponentModel, DocPageModel } from "../../src/models";
import { DocsTables } from "../../src/snapshot";
import {
  DocsBreadcrumbsView,
  DocsComponentView,
  DocsElements,
  DocsExamplesView,
  DocsFooterView,
  DocsHeaderView,
  DocsMembersView,
  DocsPageSectionsView,
  DocsPreviewView,
  DocsRelatedSymbolsView,
  DocsSearchView,
  DocsSignatureView,
  DocsSourceView,
  DocsSymbolView,
  DocsTableOfContentsView,
  DocsTutorialView,
} from "../../src/ui";

const VIEW_MODELS: readonly (readonly [new () => Model, string])[] = [
  [DocsHeaderView, DocsElements.HEADER],
  [DocsFooterView, DocsElements.FOOTER],
  [DocsSearchView, DocsElements.SEARCH],
  [DocsBreadcrumbsView, DocsElements.BREADCRUMBS],
  [DocsTableOfContentsView, DocsElements.TOC],
  [DocsPageSectionsView, DocsElements.SECTIONS],
  [DocsSymbolView, DocsElements.SYMBOL],
  [DocsSignatureView, DocsElements.SIGNATURE],
  [DocsMembersView, DocsElements.MEMBERS],
  [DocsExamplesView, DocsElements.EXAMPLES],
  [DocsComponentView, DocsElements.COMPONENT],
  [DocsPreviewView, DocsElements.PREVIEW],
  [DocsSourceView, DocsElements.SOURCE],
  [DocsTutorialView, DocsElements.TUTORIAL],
  [DocsRelatedSymbolsView, DocsElements.RELATED],
];

describe("docs model UI metadata", () => {
  it.each(DocsTables.map((table) => [table.name, table.model] as const))(
    "%s declares @uimodel and @uielement metadata",
    (_name, model) => {
      expect(Model.uiModelOf(model as never)).toBeDefined();

      const properties = Model.uiPropertiesOf(model as never) ?? [];
      expect(properties.length).toBeGreaterThan(0);
      for (const property of properties) {
        const element = Model.uiElementOf(model as never, property as never);
        expect(element).toBeDefined();
        expect(typeof element?.tag).toBe("string");
      }
    }
  );

  it.each(
    VIEW_MODELS.map(([view, tag]) => [view.name, view, tag] as const)
  )(
    "%s binds its view to its semantic tag",
    (_name, view, tag) => {
      expect(Model.uiModelOf(view as never)).toMatchObject({ tag });

      const properties = Model.uiPropertiesOf(view as never) ?? [];
      expect(properties.length).toBeGreaterThan(0);
      for (const property of properties)
        expect(Model.uiElementOf(view as never, property as never)).toBeDefined();
    }
  );

  it("rejects a docs model missing a required field", () => {
    const component = new DocComponentModel({ uid: "component:missing" });
    const errors = Model.hasErrors(component, false);

    expect(errors).toBeDefined();
    expect(errors).toHaveProperty("docletUid");
    expect(errors).toHaveProperty("framework");
    expect(errors).toHaveProperty("name");
    expect(errors).toHaveProperty("exportName");
    expect(errors).toHaveProperty("sourceFile");
  });

  it("rejects a publication model missing required identity fields", () => {
    const page = new DocPageModel({ uid: "page:missing" });
    const errors = Model.hasErrors(page, false);

    expect(errors).toBeDefined();
    expect(errors).toHaveProperty("title");
    expect(errors).toHaveProperty("kind");
    expect(errors).toHaveProperty("route");
    expect(errors).toHaveProperty("layoutId");
    expect(errors).toHaveProperty("navigationUid");
  });

  it("rejects a view model missing its required binding", () => {
    const header = new DocsHeaderView();
    const errors = Model.hasErrors(header, false);

    expect(errors).toBeDefined();
    expect(errors).toHaveProperty("brand");
  });
});
