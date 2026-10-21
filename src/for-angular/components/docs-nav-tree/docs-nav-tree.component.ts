import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders one level (and nested levels) of the documentation navigation tree.
 * @summary Native target of the "docs.navigation" element and the recursive
 * building block of the sidebar: takes navigation entries with optional
 * `children` and renders links for each entry, recursing into child levels.
 * Re-exported as `DocsNavChildrenComponent` for renderer-agnostic consumers.
 * @component DocsNavTreeComponent
 * @example
 * <docs-nav-tree [items]="navigationItems"></docs-nav-tree>
 * @category Components
 */
@Component({
  selector: "docs-nav-tree",
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl: "./docs-nav-tree.component.html",
  styleUrl: "./docs-nav-tree.component.css",
})
export class DocsNavTreeComponent extends DocsBlockBase {

  get treeItems(): {
    uid: string;
    label: string;
    route?: string;
    anchor?: string;
    kind?: string;
    children?: unknown[];
  }[] {
    return (this.items as {
      uid: string;
      label: string;
      route?: string;
      anchor?: string;
      kind?: string;
      children?: unknown[];
    }[]) ?? [];
  }

}
