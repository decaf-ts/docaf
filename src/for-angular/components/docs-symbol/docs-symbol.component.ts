import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { renderMarkdown } from "../docs-shared";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the symbol header (name, kind, category, summary) of a docs page.
 * @summary Native target of the "docs.symbol" element: extracts the title,
 * kind, category and summary child fields, renders the summary as markdown,
 * and projects every non-reserved child block below the header.
 * @component DocsSymbolComponent
 * @example
 * <docs-symbol [value]="{ title: 'DocletModel', kind: 'class' }"></docs-symbol>
 * @category Components
 */
@Component({
  selector: "docs-symbol",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-symbol.component.html",
  styleUrl: "./docs-symbol.component.css",
})
export class DocsSymbolComponent extends DocsBlockBase {

  get title(): string {
    return this.childText("title");
  }

  get kind(): string {
    return this.childText("kind");
  }

  get category(): string {
    return this.childText("category");
  }

  get summary(): string {
    return this.childText("summary");
  }

  get summaryHtml(): string {
    return renderMarkdown(this.summary);
  }

  get extras() {
    const names = new Set(["title", "kind", "category", "summary"]);
    return this.blocks.filter((block) => !names.has(String(block.props?.["name"] ?? "")));
  }

}
