import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsPageBase } from "../docs-page-base";

/**
 * @description Renders a tutorial page from its layout blocks.
 * @summary Native target of the "docs.layout.tutorial" element: composes the
 * page symbol header and the tutorial content view of the page from the
 * layout's child blocks.
 * @component DocsTutorialPageComponent
 * @example
 * <docs-tutorial-page [value]="tutorialPageLayout"></docs-tutorial-page>
 * @category Components
 */
@Component({
  selector: "docs-tutorial-page",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-tutorial-page.component.html",
  styleUrl: "./docs-tutorial-page.component.css",
})
export class DocsTutorialPageComponent extends DocsPageBase {

}
