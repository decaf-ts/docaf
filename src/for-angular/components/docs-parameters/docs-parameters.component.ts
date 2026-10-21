import { Component } from "@angular/core";
import { asParameters } from "../docs-shared";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the parameter table of a documented signature.
 * @summary Native target of the "docs.parameters" element: normalizes the
 * parameter rows (name, type, flags, default value, description) and renders
 * them as a definition list.
 * @component DocsParametersComponent
 * @example
 * <docs-parameters [items]="signature.parameters"></docs-parameters>
 * @category Components
 */
@Component({
  selector: "docs-parameters",
  standalone: true,
  imports: [
    
  ],
  templateUrl: "./docs-parameters.component.html",
  styleUrl: "./docs-parameters.component.css",
})
export class DocsParametersComponent extends DocsBlockBase {

  get parameters() {
    return asParameters(this.listValue);
  }

}
