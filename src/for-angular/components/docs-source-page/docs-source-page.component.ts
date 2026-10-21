import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsPageBase } from "../docs-page-base";

/**
 * @description Renders a source listing page from its layout blocks.
 * @summary Native target of the "docs.layout.source" element: composes the
 * page symbol header and the source view of the page from the layout's child
 * blocks.
 * @component DocsSourcePageComponent
 * @example
 * <docs-source-page [value]="sourcePageLayout"></docs-source-page>
 * @category Components
 */
@Component({
  selector: "docs-source-page",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-source-page.component.html",
  styleUrl: "./docs-source-page.component.css",
})
export class DocsSourcePageComponent extends DocsPageBase {

}
