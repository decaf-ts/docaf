import { Component } from "@angular/core";
import { DocsChildrenComponent } from "../docs-children/docs-children.component";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders plain or markdown-ish text content for a docs block.
 * @summary Displays the block's text value (heading level, plain paragraph or
 * inline content) and projects any extra child fields through `docs-children`.
 * It is the native target for the "docs.text" and "docs.heading" semantic tags.
 * @component DocsTextComponent
 * @example
 * <docs-text [value]="symbol.description" [level]="2"></docs-text>
 * @category Components
 */
@Component({
  selector: "docs-text",
  standalone: true,
  imports: [
    DocsChildrenComponent
  ],
  templateUrl: "./docs-text.component.html",
  styleUrl: "./docs-text.component.css",
})
export class DocsTextComponent extends DocsBlockBase {

}
