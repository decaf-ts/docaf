import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the documentation sidebar wrapper.
 * @summary Native target of the "docs.sidebar" layout element: hosts the
 * navigation view (search plus navigation items) and any extra child blocks.
 * The actual entries come from the navigation records built by DocsPageService.
 * @component DocsSidebarComponent
 * @example
 * <docs-sidebar [value]="navigationView"></docs-sidebar>
 * @category Components
 */
@Component({
  selector: "docs-sidebar",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-sidebar.component.html",
  styleUrl: "./docs-sidebar.component.css",
})
export class DocsSidebarComponent extends DocsBlockBase {

}
