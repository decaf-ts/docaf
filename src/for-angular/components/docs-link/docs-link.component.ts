import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders a single documentation link (internal route, anchor, or external href).
 * @summary Native target of the "docs.link" element. Accepts either a plain
 * string label or an object with `label`/`name`, `route`, `anchor` and `href`
 * fields; internal targets render as router links, external ones as plain
 * anchors.
 * @component DocsLinkComponent
 * @example
 * <docs-link [value]="{ label: 'Home', route: '/' }"></docs-link>
 * @category Components
 */
@Component({
  selector: "docs-link",
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl: "./docs-link.component.html",
  styleUrl: "./docs-link.component.css",
})
export class DocsLinkComponent extends DocsBlockBase {

  get target(): { label: string; route?: string; anchor?: string; href?: string } {
    if (typeof this.value === "string") return { label: this.value };
    const value = (this.value ?? {}) as Record<string, unknown>;
    return {
      label: (value["label"] as string) ?? (value["name"] as string) ?? "",
      route: (value["route"] as string) ?? undefined,
      anchor: (value["anchor"] as string) ?? undefined,
      href: (value["href"] as string) ?? undefined,
    };
  }

}
