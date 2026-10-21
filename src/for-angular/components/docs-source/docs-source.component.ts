import { Component } from "@angular/core";
import { DocsCodeComponent } from "../docs-code/docs-code.component";
import { asSource } from "../docs-shared";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the source location of a documented symbol.
 * @summary Native target of the "docs.source" element: resolves the source
 * entry (direct value, first list item, or "docs.source.view" child), renders
 * the file path with line/column as a code block, and links the repository URL
 * when present.
 * @component DocsSourceComponent
 * @example
 * <docs-source [value]="{ fileName: 'src/index.ts', line: 12 }"></docs-source>
 * @category Components
 */
@Component({
  selector: "docs-source",
  standalone: true,
  imports: [
    DocsCodeComponent
  ],
  templateUrl: "./docs-source.component.html",
  styleUrl: "./docs-source.component.css",
})
export class DocsSourceComponent extends DocsBlockBase {

  get source() {
    const direct = asSource(this.value);
    if (direct) return direct;
    return asSource(this.listValue[0]) ?? { fileName: "unknown" };
  }

  get displayPath(): string {
    const source = this.source;
    return source.line
      ? source.fileName + ":" + source.line + (source.column ? ":" + source.column : "")
      : source.fileName;
  }

}
