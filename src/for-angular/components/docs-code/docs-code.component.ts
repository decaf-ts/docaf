import { Component } from "@angular/core";
import { highlightCode } from "../docs-shared";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders a syntax-highlighted code block with a copy-to-clipboard button.
 * @summary Native target of the "docs.code" element. Highlights the resolved
 * code (explicit `code` input, a "docs.code" child, or the block value) with
 * the shared lightweight highlighter, labels the language, and copies the raw
 * code to the clipboard on demand.
 * @component DocsCodeComponent
 * @example
 * <docs-code [code]="'const x = 1;'" [language]="'ts'"></docs-code>
 * @category Components
 */
@Component({
  selector: "docs-code",
  standalone: true,
  imports: [
    
  ],
  templateUrl: "./docs-code.component.html",
  styleUrl: "./docs-code.component.css",
})
export class DocsCodeComponent extends DocsBlockBase {

  copied = false;

  get highlighted(): string {
    return highlightCode(this.codeValue, this.languageValue);
  }

  get languageLabel(): string {
    return (this.languageValue ?? "ts").toLowerCase();
  }

  async copy(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(this.codeValue);
    this.copied = true;
    setTimeout(() => {
      this.copied = false;
    }, 1500);
  }

}
