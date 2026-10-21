import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the client-side documentation search box with live results.
 * @summary Native target of the "docs.search" element. Filters the provided
 * search index entries (from the `items`/`value` input) against the typed term,
 * matching entry names and summaries case-insensitively, and renders at most
 * 20 matching entries as links.
 * @component DocsSearchComponent
 * @example
 * <docs-search [items]="searchEntries"></docs-search>
 * @category Components
 */
@Component({
  selector: "docs-search",
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl: "./docs-search.component.html",
  styleUrl: "./docs-search.component.css",
})
export class DocsSearchComponent extends DocsBlockBase {

  term = "";

  get entries(): {
    uid: string;
    name: string;
    kind: string;
    summary?: string;
    route?: string;
    anchor?: string;
  }[] {
    return (this.listValue as {
      uid: string;
      name: string;
      kind: string;
      summary?: string;
      route?: string;
      anchor?: string;
    }[]).filter((entry) => Boolean(entry) && typeof entry === "object");
  }

  get results() {
    const term = this.term.trim().toLowerCase();
    if (!term) return [];
    return this.entries
      .filter(
        (entry) =>
          entry.name?.toLowerCase().includes(term) ||
          (entry.summary ?? "").toLowerCase().includes(term)
      )
      .slice(0, 20);
  }

  update(value: string): void {
    this.term = value;
  }

}
