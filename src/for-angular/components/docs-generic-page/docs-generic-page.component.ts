import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsPageBase } from "../docs-page-base";
import { DocsClassPageComponent } from "../docs-class-page/docs-class-page.component";
import { DocsComponentPageComponent } from "../docs-component-page/docs-component-page.component";
import { DocsHomePageComponent } from "../docs-home-page/docs-home-page.component";
import { DocsSourcePageComponent } from "../docs-source-page/docs-source-page.component";
import { DocsTutorialPageComponent } from "../docs-tutorial-page/docs-tutorial-page.component";

/**
 * @description Renders a documentation page by dispatching to the matching dedicated page component.
 * @summary Native target of the "docs.layout.page" and "docs.layout.content"
 * elements: reads the scalar "kind" block of the page layout via
 * {@link DocsGenericPageComponent.pageKind} and delegates to the dedicated page
 * component matching that kind or the layout's available blocks ("docs-home-page",
 * "docs-component-page", "docs-tutorial-page", "docs-source-page", or
 * "docs-class-page"); when no dedicated composition applies, renders the
 * remaining content blocks (see {@link DocsGenericPageComponent.contentBlocks})
 * through the component renderer as the generic fallback.
 * @component DocsGenericPageComponent
 * @example
 * <docs-generic-page [value]="genericPageLayout"></docs-generic-page>
 * @category Components
 */
@Component({
  selector: "docs-generic-page",
  standalone: true,
  imports: [
    ComponentRendererComponent,
    DocsClassPageComponent,
    DocsComponentPageComponent,
    DocsHomePageComponent,
    DocsSourcePageComponent,
    DocsTutorialPageComponent,
  ],
  templateUrl: "./docs-generic-page.component.html",
  styleUrl: "./docs-generic-page.component.css",
})
export class DocsGenericPageComponent extends DocsPageBase {
  /**
   * @description Returns the lower-cased page kind declared by the layout.
   * @summary Resolves the scalar "kind" pseudo-block of the page layout through
   * {@link DocsBlockBase.childText} and normalizes it to lower case, so the
   * template can dispatch to the matching dedicated page component.
   * @returns {string} the page kind in lower case ("" when the layout declares none).
   */
  protected get pageKind(): string {
    return this.childText("kind").toLowerCase();
  }

  /**
   * @description Returns the page layout blocks other than the "kind" pseudo-block.
   * @summary Filters {@link DocsPageBase.blocks} to drop the scalar "kind"
   * block (matched by field name or `props["name"]`), leaving the renderable
   * content blocks for the generic fallback composition.
   * @returns {DocsFieldDefinition[]} the content blocks, excluding "kind".
   */
  protected get contentBlocks() {
    return this.blocks.filter(
      (block) => block.name !== "kind" && block.props?.["name"] !== "kind"
    );
  }
}
