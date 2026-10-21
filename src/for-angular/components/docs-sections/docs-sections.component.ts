import { Component } from "@angular/core";
import { DocsChildrenComponent } from "../docs-children/docs-children.component";
import { DocsSignatureComponent } from "../docs-signature/docs-signature.component";
import { DocsMembersComponent } from "../docs-members/docs-members.component";
import { DocsExamplesComponent } from "../docs-examples/docs-examples.component";
import { DocsSourceComponent } from "../docs-source/docs-source.component";
import { asSections } from "../docs-shared";
import { renderMarkdown } from "../docs-shared";
import { DocsBlockBase } from "../docs-block-base";
import type { DocsSectionEntry, DocsSourceViewEntry } from "../../../ui/views/DocsViews";

/**
 * @description Renders the ordered content sections of a documentation page.
 * @summary Native target of the "docs.sections" element: normalizes the section
 * entries and dispatches each to the right renderer - markdown prose is
 * rendered with the shared markdown renderer, signature sections to
 * `docs-signature`, member rows to `docs-members`, example sections to
 * `docs-examples`, and source sections to `docs-source`, which renders its own
 * title so no outer section heading is emitted for them.
 * @component DocsSectionsComponent
 * @example
 * <docs-sections [items]="pageSections"></docs-sections>
 * @category Components
 */
@Component({
  selector: "docs-sections",
  standalone: true,
  imports: [
    DocsChildrenComponent, 
    DocsSignatureComponent, 
    DocsMembersComponent, 
    DocsExamplesComponent,
    DocsSourceComponent,
  ],
  templateUrl: "./docs-sections.component.html",
  styleUrl: "./docs-sections.component.css",
})
export class DocsSectionsComponent extends DocsBlockBase {

  get sections() {
    return asSections(this.listValue);
  }

  sourceValue(section: DocsSectionEntry): DocsSourceViewEntry {
    return section.source ?? { fileName: section.code || "unknown" };
  }

  sectionHtml(section: { content?: string }): string {
    return renderMarkdown(section.content ?? "");
  }

}
