import { Directive } from "@angular/core";
import { DocsElements } from "../../ui/rendering/DocsSemanticTags";
import { DocsBlockBase } from "./docs-block-base";
import type { DocsFieldDefinition } from "./docs-shared";

/**
 * @description Semantic tags reserved for the standard page slots.
 * @summary Every block whose tag appears here is exposed through a dedicated
 * `DocsPageBase` accessor and therefore excluded from `extraBlocks`.
 */
const PAGE_SLOT_TAGS = new Set<string>([
  DocsElements.BREADCRUMBS,
  DocsElements.SYMBOL,
  DocsElements.SECTIONS,
  DocsElements.RELATED,
  DocsElements.PREVIEW,
  DocsElements.TUTORIAL,
  DocsElements.SOURCE,
]);

/**
 * @description Abstract base class for docs page-layout components (class, component,
 * tutorial, source, home, and generic pages).
 * @summary Extends {@link DocsBlockBase} with named accessors for the standard
 * page slots (breadcrumbs, symbol header, sections, related symbols, preview,
 * tutorial content, source) defined by the docs page layouts, plus `extraBlocks`
 * for anything outside those slots. Concrete page components map a
 * "docs.layout.*" tag to its native composition.
 * @class DocsPageBase
 * @category Components
 * @example
 * export class DocsClassPageComponent extends DocsPageBase {
 *   get crumbs() {
 *     return this.breadcrumbsBlock?.value;
 *   }
 * }
 */
@Directive()
export abstract class DocsPageBase extends DocsBlockBase {
  /**
   * @description Returns the breadcrumbs block of the page layout.
   * @summary Looks up the first child with the slot's semantic tag.
   * @returns {DocsFieldDefinition | undefined} the slot's block, when present.
   */
  get breadcrumbsBlock(): DocsFieldDefinition | undefined {
    return this.child(DocsElements.BREADCRUMBS);
  }

  /**
   * @description Returns the symbol header block of the page layout.
   * @summary Looks up the first child with the slot's semantic tag.
   * @returns {DocsFieldDefinition | undefined} the slot's block, when present.
   */
  get symbolBlock(): DocsFieldDefinition | undefined {
    return this.child(DocsElements.SYMBOL);
  }

  /**
   * @description Returns the content sections block of the page layout.
   * @summary Looks up the first child with the slot's semantic tag.
   * @returns {DocsFieldDefinition | undefined} the slot's block, when present.
   */
  get sectionsBlock(): DocsFieldDefinition | undefined {
    return this.child(DocsElements.SECTIONS);
  }

  /**
   * @description Returns the related-symbols block of the page layout.
   * @summary Looks up the first child with the slot's semantic tag.
   * @returns {DocsFieldDefinition | undefined} the slot's block, when present.
   */
  get relatedBlock(): DocsFieldDefinition | undefined {
    return this.child(DocsElements.RELATED);
  }

  /**
   * @description Returns the live preview block of the page layout.
   * @summary Looks up the first child with the slot's semantic tag.
   * @returns {DocsFieldDefinition | undefined} the slot's block, when present.
   */
  get previewBlock(): DocsFieldDefinition | undefined {
    return this.child(DocsElements.PREVIEW);
  }

  /**
   * @description Returns the tutorial content block of the page layout.
   * @summary Looks up the first child with the slot's semantic tag.
   * @returns {DocsFieldDefinition | undefined} the slot's block, when present.
   */
  get tutorialBlock(): DocsFieldDefinition | undefined {
    return this.child(DocsElements.TUTORIAL);
  }

  /**
   * @description Returns the source view block of the page layout.
   * @summary Looks up the first child with the slot's semantic tag.
   * @returns {DocsFieldDefinition | undefined} the slot's block, when present.
   */
  get sourceBlock(): DocsFieldDefinition | undefined {
    return this.child(DocsElements.SOURCE);
  }

  /**
   * @description Returns the page layout blocks outside the standard slots.
   * @summary Filters {@link DocsPageBase.blocks} against the reserved page slot
   * tags and drops the scalar "kind" pseudo-block, so concrete page components
   * can project additional content.
   * @returns {DocsFieldDefinition[]} the non-slot child blocks, excluding "kind".
   */
  get extraBlocks(): DocsFieldDefinition[] {
    return this.blocks.filter(
      (block) =>
        !PAGE_SLOT_TAGS.has(block.tag) &&
        block.name !== "kind" &&
        block.props?.["name"] !== "kind"
    );
  }
}
