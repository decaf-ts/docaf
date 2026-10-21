import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the related-symbols list of a documentation page.
 * @summary Native target of the "docs.related" element: renders the navigation
 * entries pointing to symbols of the same kind as the current page as a short
 * list of links.
 * @component DocsRelatedComponent
 * @example
 * <docs-related [items]="relatedSymbols"></docs-related>
 * @category Components
 */
@Component({
  selector: "docs-related",
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl: "./docs-related.component.html",
  styleUrl: "./docs-related.component.css",
})
export class DocsRelatedComponent extends DocsBlockBase {

  get related(): { uid: string; label: string; route?: string; anchor?: string }[] {
    return (this.listValue as { uid: string; label: string; route?: string; anchor?: string }[]).filter(
      (item) => Boolean(item) && typeof item === "object"
    );
  }

}
