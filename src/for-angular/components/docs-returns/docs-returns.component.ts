import { Component } from "@angular/core";
import { asReturns } from "../docs-shared";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the return/yield declarations of a documented signature.
 * @summary Native target of the "docs.returns" element: normalizes the return
 * rows (role, type, element type, nullability, description) and renders them
 * as a definition list.
 * @component DocsReturnsComponent
 * @example
 * <docs-returns [items]="signature.returns"></docs-returns>
 * @category Components
 */
@Component({
  selector: "docs-returns",
  standalone: true,
  imports: [
    
  ],
  templateUrl: "./docs-returns.component.html",
  styleUrl: "./docs-returns.component.css",
})
export class DocsReturnsComponent extends DocsBlockBase {

  get returns() {
    return asReturns(this.listValue);
  }

}
