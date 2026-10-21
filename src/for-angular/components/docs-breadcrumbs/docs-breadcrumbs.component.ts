import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the breadcrumb trail of the current documentation page.
 * @summary Native target of the "docs.breadcrumbs" element: renders each crumb
 * as a link when it declares a route and as plain text otherwise (e.g. the page
 * kind), preserving the order built by DocsPageService.
 * @component DocsBreadcrumbsComponent
 * @example
 * <docs-breadcrumbs [value]="[{ label: 'Home', route: '/' }, { label: 'Class' }]"></docs-breadcrumbs>
 * @category Components
 */
@Component({
  selector: "docs-breadcrumbs",
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl: "./docs-breadcrumbs.component.html",
  styleUrl: "./docs-breadcrumbs.component.css",
})
export class DocsBreadcrumbsComponent extends DocsBlockBase {

  get crumbs(): { label: string; route?: string }[] {
    return (this.listValue as { label: string; route?: string }[]).filter(
      (item) => Boolean(item) && typeof item === "object"
    );
  }

}
