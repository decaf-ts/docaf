import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DocsChildrenComponent } from "../docs-children/docs-children.component";
import { asMembers } from "../docs-shared";
import { groupMembers } from "../docs-shared";
import { DocsBlockBase } from "../docs-block-base";

/**
 * @description Renders the API members of a documented symbol grouped by kind.
 * @summary Native target of the "docs.members" element: normalizes the member
 * rows, groups them by kind (methods, properties, events, ...) with friendly
 * labels, and renders each group with its members; member links fall back to
 * in-page anchors.
 * @component DocsMembersComponent
 * @example
 * <docs-members [items]="classMembers"></docs-members>
 * @category Components
 */
@Component({
  selector: "docs-members",
  standalone: true,
  imports: [
    RouterLink, 
    DocsChildrenComponent
  ],
  templateUrl: "./docs-members.component.html",
  styleUrl: "./docs-members.component.css",
})
export class DocsMembersComponent extends DocsBlockBase {

  get members() {
    return asMembers(this.listValue);
  }

  get groups() {
    return groupMembers(this.members);
  }

}
