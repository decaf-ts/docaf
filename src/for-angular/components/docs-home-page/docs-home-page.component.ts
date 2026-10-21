import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsPageBase } from "../docs-page-base";

/**
 * @description Renders the documentation home page from its layout blocks.
 * @summary Native target of the "docs.layout.home" element: composes the page
 * symbol header and the auto-generated "explore" sections (Components,
 * Tutorials, API) of the home page from the layout's child blocks.
 * @component DocsHomePageComponent
 * @example
 * <docs-home-page [value]="homeLayout"></docs-home-page>
 * @category Components
 */
@Component({
  selector: "docs-home-page",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-home-page.component.html",
  styleUrl: "./docs-home-page.component.css",
})
export class DocsHomePageComponent extends DocsPageBase {

}
