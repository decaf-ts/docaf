import { Component } from "@angular/core";
import { DocsChildrenComponent } from "../docs-children/docs-children.component";
import { DocsParametersComponent } from "../docs-parameters/docs-parameters.component";
import { DocsReturnsComponent } from "../docs-returns/docs-returns.component";
import { DocsElements } from "../../../ui/rendering/DocsSemanticTags";
import { asMembers } from "../docs-shared";
import { asParameters } from "../docs-shared";
import { asReturns } from "../docs-shared";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders one callable signature with its parameters and returns.
 * @summary Native target of the "docs.signature" element: resolves the member
 * (preferring the section's members over the block list), renders the signature
 * text and description, and delegates to `docs-parameters`/`docs-returns` for
 * the parameter and return tables.
 * @component DocsSignatureComponent
 * @example
 * <docs-signature [section]="signatureSection"></docs-signature>
 * @category Components
 */
@Component({
  selector: "docs-signature",
  standalone: true,
  imports: [
    DocsChildrenComponent, 
    DocsParametersComponent, 
    DocsReturnsComponent
  ],
  templateUrl: "./docs-signature.component.html",
  styleUrl: "./docs-signature.component.css",
})
export class DocsSignatureComponent extends DocsBlockBase {

  get members() {
    if (this.section?.members?.length) return this.section.members;
    return asMembers(this.listValue);
  }

  get member() {
    return this.members[0];
  }

  get signatureText(): string {
    return (
      this.member?.signature ??
      this.childText(DocsElements.SIGNATURE_PARAMETERS) ??
      ""
    );
  }

  get description(): string {
    return (
      this.member?.description ??
      this.childText(DocsElements.SIGNATURE_RETURNS) ??
      ""
    );
  }

  get parameters() {
    if (this.section?.parameters?.length) return this.section.parameters;
    return asParameters(this.listValue);
  }

  get returns() {
    if (this.section?.returns?.length) return this.section.returns;
    return asReturns(this.listValue);
  }

}
