import { Component } from "@angular/core";
import { DocsNavTreeComponent } from "../docs-nav-tree/docs-nav-tree.component";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the full sidebar navigation list from flattened navigation entries.
 * @summary Native target of the "docs.navigation.items" element: maps the
 * navigation entry list (produced by DocsPageService) to the recursive
 * `docs-nav-tree`, rendering the complete sidebar menu.
 * @component DocsNavigationItemsComponent
 * @example
 * <docs-navigation [items]="navigationEntries"></docs-navigation>
 * @category Components
 */
@Component({
  selector: "docs-navigation",
  standalone: true,
  imports: [
    DocsNavTreeComponent
  ],
  templateUrl: "./docs-navigation.component.html",
  styleUrl: "./docs-navigation.component.css",
})
export class DocsNavigationItemsComponent extends DocsBlockBase {

  get navigationItems() {
    return (this.listValue as {
      uid: string;
      label: string;
      route?: string;
      anchor?: string;
      children?: unknown[];
    }[]).filter((item) => Boolean(item) && typeof item === "object");
  }

}
