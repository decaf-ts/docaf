import { Component } from "@angular/core";
import { DocsChildrenComponent } from "../docs-children/docs-children.component";
import { DocsElements } from "../../../ui/rendering/DocsSemanticTags";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the metadata (selector, inputs, outputs) of a documented component.
 * @summary Native target of the "docs.component" element: resolves the
 * component view record (direct value or "docs.component.view" child) and
 * renders the component's selector/framework plus its input and output tables
 * through `docs-children`.
 * @component DocsComponentMetadataComponent
 * @example
 * <docs-component-metadata [value]="componentView"></docs-component-metadata>
 * @category Components
 */
@Component({
  selector: "docs-component-metadata",
  standalone: true,
  imports: [
    DocsChildrenComponent
  ],
  templateUrl: "./docs-component.component.html",
  styleUrl: "./docs-component.component.css",
})
export class DocsComponentMetadataComponent extends DocsBlockBase {

  get component() {
    const direct = this.value as
      | {
          name: string;
          selector?: string;
          framework: string;
          properties: { name: string; alias?: string; typeText?: string; defaultValue?: string; description?: string; required?: boolean }[];
          events: { name: string; payloadTypeText?: string; description?: string }[];
        }
      | undefined;
    if (direct && typeof direct === "object" && "properties" in direct) return direct;
    const field = this.child(DocsElements.COMPONENT_VIEW);
    return field ? (field.props?.["value"] as typeof direct) : undefined;
  }

}
