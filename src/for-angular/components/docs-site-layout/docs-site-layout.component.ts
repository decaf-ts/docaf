import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsElements } from "../../../ui/rendering/DocsSemanticTags";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the root site layout of a documentation page.
 * @summary Native target of the "docs.layout.site" element: resolves the
 * header, body, and footer child blocks and renders them in the site grid,
 * projecting the body layout between them.
 * @component DocsSiteLayoutComponent
 * @example
 * <docs-site-layout [value]="siteLayout"></docs-site-layout>
 * @category Components
 */
@Component({
  selector: "docs-site-layout",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-site-layout.component.html",
  styleUrl: "./docs-site-layout.component.css",
})
export class DocsSiteLayoutComponent extends DocsBlockBase {

  get headerBlock() {
    return this.child(DocsElements.HEADER);
  }

  get bodyBlock() {
    return this.child(DocsElements.BODY_LAYOUT);
  }

  get footerBlock() {
    return this.child(DocsElements.FOOTER);
  }

}
