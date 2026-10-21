import { Component } from "@angular/core";
import { ComponentRendererComponent } from "@decaf-ts/for-angular";
import { DocsPageBase } from "../docs-page-base";

/**
 * @description Renders a class-like API page (class, interface, enum, typedef, namespace).
 * @summary Native target of the "docs.layout.class" element: composes the
 * breadcrumbs, symbol header, section list, and related symbols of the page
 * from the layout's child blocks, rendering any extra blocks as well.
 * @component DocsClassPageComponent
 * @example
 * <docs-class-page [value]="classPageLayout"></docs-class-page>
 * @category Components
 */
@Component({
  selector: "docs-class-page",
  standalone: true,
  imports: [
    ComponentRendererComponent
  ],
  templateUrl: "./docs-class-page.component.html",
  styleUrl: "./docs-class-page.component.css",
})
export class DocsClassPageComponent extends DocsPageBase {

}
