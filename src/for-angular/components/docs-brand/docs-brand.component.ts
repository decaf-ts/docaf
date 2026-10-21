import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the documentation site brand as a link back to the home route.
 * @summary Native target of the "docs.brand" element: shows the brand text and
 * links to the route declared by the `route` child field (defaulting to "/").
 * Used by the site header built from the docs manifest.
 * @component DocsBrandComponent
 * @example
 * <docs-brand [value]="'docaf'"><docs-brand>
 * @category Components
 */
@Component({
  selector: "docs-brand",
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl: "./docs-brand.component.html",
  styleUrl: "./docs-brand.component.css",
})
export class DocsBrandComponent extends DocsBlockBase {

  get route(): string {
    const props = (this.named("route")?.props ?? {}) as Record<string, unknown>;
    return (props["route"] as string) ?? "/";
  }

}
