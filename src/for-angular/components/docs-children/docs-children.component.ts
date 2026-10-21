import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the child blocks of a docs field through the shared component renderer.
 * @summary Generic container used whenever a docs block only needs to project its
 * nested semantic-tag children (e.g. leaf slots of a section). Reads the standard
 * `children` input from {@link DocsBlockBase} and hands each field to
 * `ngx-decaf-component-renderer`, so any registered docs element can appear inside.
 * @component DocsChildrenComponent
 * @example
 * <docs-children [children]="block.children"></docs-children>
 * @category Components
 */
@Component({
  selector: "docs-children",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-children.component.html",
  styleUrl: "./docs-children.component.css",
})
export class DocsChildrenComponent extends DocsBlockBase {

}
