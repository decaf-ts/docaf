import { Component } from "@angular/core";
import { DocsCodeComponent } from "../docs-code/docs-code.component";
import { asExamples } from "../docs-shared";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the code examples attached to a documented symbol.
 * @summary Native target of the "docs.examples" element: normalizes the block
 * list into example entries and renders each one's caption and highlighted
 * code via `docs-code`.
 * @component DocsExamplesComponent
 * @example
 * <docs-examples [items]="examples"></docs-examples>
 * @category Components
 */
@Component({
  selector: "docs-examples",
  standalone: true,
  imports: [
    DocsCodeComponent
  ],
  templateUrl: "./docs-examples.component.html",
  styleUrl: "./docs-examples.component.css",
})
export class DocsExamplesComponent extends DocsBlockBase {

  get examples() {
    return asExamples(this.listValue);
  }

}
