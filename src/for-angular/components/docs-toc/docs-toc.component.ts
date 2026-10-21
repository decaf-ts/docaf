import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the "On this page" table of contents of the current page.
 * @summary Native target of the "docs.toc" element: renders the optional
 * heading (defaulting to "On this page") and the ordered anchor entries derived
 * from the page's titled sections.
 * @component DocsTocComponent
 * @example
 * <docs-toc [items]="[{ label: 'Methods', anchor: 'section-methods' }]"></docs-toc>
 * @category Components
 */
@Component({
  selector: "docs-toc",
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl: "./docs-toc.component.html",
  styleUrl: "./docs-toc.component.css",
})
export class DocsTocComponent extends DocsBlockBase {

  get title(): string {
    return this.childText("title") || "On this page";
  }

  get entries(): { label: string; anchor?: string; level?: number }[] {
    return (this.listValue as { label: string; anchor?: string; level?: number }[]).filter(
      (item) => Boolean(item) && typeof item === "object"
    );
  }

}
