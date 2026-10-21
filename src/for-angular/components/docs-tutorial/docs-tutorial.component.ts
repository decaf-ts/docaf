import { Component } from "@angular/core";
import { DocsElements } from "../../../ui/rendering/DocsSemanticTags";
import { renderMarkdown } from "../docs-shared";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders tutorial prose content as markdown.
 * @summary Native target of the "docs.tutorial" and "docs.markdown" elements:
 * resolves the tutorial content (direct string value, "docs.tutorial.content"
 * child, or block text) and renders it through the shared markdown renderer.
 * @component DocsTutorialComponent
 * @example
 * <docs-tutorial [value]="'# Getting started\n\nInstall docaf.'"></docs-tutorial>
 * @category Components
 */
@Component({
  selector: "docs-tutorial",
  standalone: true,
  imports: [
    
  ],
  templateUrl: "./docs-tutorial.component.html",
  styleUrl: "./docs-tutorial.component.css",
})
export class DocsTutorialComponent extends DocsBlockBase {

  get content(): string {
    const direct = typeof this.value === "string" ? this.value : "";
    if (direct.trim().length) return direct;
    const field = this.child(DocsElements.TUTORIAL_CONTENT);
    return field ? this.fieldText(field) : this.textValue;
  }

  get html(): string {
    return renderMarkdown(this.content);
  }

}
