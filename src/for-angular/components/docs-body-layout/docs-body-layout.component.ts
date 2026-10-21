import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsElements } from "../../../ui/rendering/DocsSemanticTags";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the three-column body layout of a documentation page.
 * @summary Native target of the "docs.layout.body" element: renders the
 * sidebar, the table of contents, and the page content layout (the first
 * "docs.layout.*" child that is not the site/body layout itself) side by side.
 * @component DocsBodyLayoutComponent
 * @example
 * <docs-body-layout [value]="bodyLayout"></docs-body-layout>
 * @category Components
 */
@Component({
  selector: "docs-body-layout",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-body-layout.component.html",
  styleUrl: "./docs-body-layout.component.css",
})
export class DocsBodyLayoutComponent extends DocsBlockBase {

  get sidebarBlock() {
    return this.child(DocsElements.SIDEBAR);
  }

  get tocBlock() {
    return this.child(DocsElements.TOC);
  }

  get contentBlock() {
    const excluded = new Set<string>([
      DocsElements.SITE_LAYOUT,
      DocsElements.BODY_LAYOUT,
      DocsElements.SIDEBAR,
      DocsElements.TOC,
    ]);
    return this.blocks.find(
      (block) => block.tag.startsWith("docs.layout.") && !excluded.has(block.tag)
    );
  }

}
