import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsPageBase } from "../docs-page-base";

/**
 * @description Renders a component documentation page with its live preview.
 * @summary Native target of the "docs.layout.component" element: composes the
 * breadcrumbs, symbol header, preview, section list, and related symbols of
 * the component page from the layout's child blocks.
 * @component DocsComponentPageComponent
 * @example
 * <docs-component-page [value]="componentPageLayout"></docs-component-page>
 * @category Components
 */
@Component({
  selector: "docs-component-page",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-component-page.component.html",
  styleUrl: "./docs-component-page.component.css",
})
export class DocsComponentPageComponent extends DocsPageBase {

}
