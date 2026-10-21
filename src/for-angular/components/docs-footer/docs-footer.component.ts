import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the site-wide documentation footer.
 * @summary Native target of the "docs.footer" element: displays the footer text
 * (typically project name and version) and projects any extra child fields.
 * @component DocsFooterComponent
 * @example
 * <docs-footer [value]="'docaf - 1.0.0'"></docs-footer>
 * @category Components
 */
@Component({
  selector: "docs-footer",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-footer.component.html",
  styleUrl: "./docs-footer.component.css",
})
export class DocsFooterComponent extends DocsBlockBase {

}
