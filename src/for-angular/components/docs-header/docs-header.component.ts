import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsElements } from "../../../ui/rendering/DocsSemanticTags";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the site-wide documentation header.
 * @summary Native target of the "docs.header" layout element: renders the brand
 * block, the optional version text, and any extra child blocks (e.g. search or
 * navigation) projected below. Built by DocsPageService from the docs manifest.
 * @component DocsHeaderComponent
 * @example
 * <docs-header [value]="{ brand: 'docaf', version: '1.0.0' }"></docs-header>
 * @category Components
 */
@Component({
  selector: "docs-header",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-header.component.html",
  styleUrl: "./docs-header.component.css",
})
export class DocsHeaderComponent extends DocsBlockBase {

  get brandBlock() {
    return this.child(DocsElements.BRAND);
  }

  get versionText(): string {
    return this.childText("version");
  }

  get extraBlocks() {
    return this.blocks.filter(
      (block) =>
        block.tag !== DocsElements.BRAND &&
        !(block.props?.["name"] === "version")
    );
  }

}
