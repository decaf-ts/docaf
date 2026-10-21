import { Directive, Input } from "@angular/core";
import type { DocsSectionEntry } from "../../ui/views/DocsViews";
import { DocsElements } from "../../ui/rendering/DocsSemanticTags";
import {
  asFields,
  childByName,
  childByTag,
  display,
  fieldValue,
  type DocsFieldDefinition,
} from "./docs-shared";

/**
 * @description Abstract base class shared by every docs Angular block component.
 * @summary Carries the common inputs every docs block accepts (`value`, `name`,
 * `level`, `className`, `children`, `section`, `code`, `language`, `items`) and
 * the small helper layer used by templates to resolve child fields, list rows,
 * code fences, and display text from those inputs. Concrete components extend it
 * and map their own semantic tag to a native rendering.
 * @class DocsBlockBase
 * @category Components
 * @example
 * export class DocsTextComponent extends DocsBlockBase {
 *   get html(): string {
 *     return this.textValue;
 *   }
 * }
 */
@Directive()
export abstract class DocsBlockBase {
  /**
   * @description Primary value carried by the block; its shape depends on the semantic tag.
   */
  @Input() value: unknown;
  /**
   * @description Optional logical name of the field, used by `named` lookups.
   */
  @Input() name?: string;
  /**
   * @description Optional heading level (1-6) for text/heading blocks; normalized by `levelNumber`.
   */
  @Input() level?: number | string;
  /**
   * @description Optional CSS class applied by concrete components to their root element.
   */
  @Input() className?: string;
  /**
   * @description Nested field definitions rendered as child blocks.
   */
  @Input() children: DocsFieldDefinition[] = [];
  /**
   * @description Optional section entry providing members, parameters, returns, or examples directly.
   */
  @Input() section?: DocsSectionEntry;
  /**
   * @description Optional explicit code fence overriding the resolved `codeValue`.
   */
  @Input() code?: string;
  /**
   * @description Optional language hint overriding the resolved `languageValue`.
   */
  @Input() language?: string;
  /**
   * @description Optional list of rows (members, entries, ...); preferred by `listValue` over `value`.
   */
  @Input() items?: unknown;

  /**
   * @description Display helper exposed to templates: renders any value as human-readable text.
   */
  readonly display = display;

  /**
   * @description Returns the normalized child field definitions of the block.
   * @summary Filters the `children` input through {@link asFields}, dropping
   * entries that are not well-formed field definitions.
   * @returns {DocsFieldDefinition[]} the normalized child blocks.
   */  get blocks(): DocsFieldDefinition[] {
    return asFields(this.children);
  }

  /**
   * @description Returns the block's primary value rendered as text.
   * @summary Displays the `value` input with {@link display}, so templates can
   * bind plain strings regardless of the underlying value shape.
   * @returns {string} the display text of the value ("" when undefined).
   */  get textValue(): string {
    return display(this.value);
  }

  /**
   * @description Normalizes the `level` input to a usable heading number.
   * @summary Coerces the level to a number, falling back to 0 when it is not a
   * finite number.
   * @returns {number} the numeric heading level (0 when unset or invalid).
   */  get levelNumber(): number {
    const level = Number(this.level);
    return Number.isFinite(level) ? level : 0;
  }

  /**
   * @description Finds the first child block with the given semantic tag.
   * @param {string} tag - semantic tag to look for (e.g. "docs.code").
   * @returns {DocsFieldDefinition | undefined} the first matching child, if any.
   */  child(tag: string): DocsFieldDefinition | undefined {
    return childByTag(this.children, tag);
  }

  /**
   * @description Finds the first child block with the given logical name.
   * @summary Matches either the field's `name` property or its `props["name"]`.
   * @param {string} name - logical name to look for.
   * @returns {DocsFieldDefinition | undefined} the first matching child, if any.
   */  named(name: string): DocsFieldDefinition | undefined {
    return childByName(this.children, name);
  }

  /**
   * @description Resolves a child block by name or tag and renders its value as text.
   * @summary Looks up the child via {@link DocsBlockBase.named} first, then
   * {@link DocsBlockBase.child}, and displays its resolved field value trimmed.
   * @param {string} nameOrTag - logical name or semantic tag of the child.
   * @returns {string} the trimmed display text ("" when no child matches).
   */  childText(nameOrTag: string): string {
    const field = this.named(nameOrTag) ?? this.child(nameOrTag);
    return display(fieldValue(field)).trim();
  }

  /**
   * @description Renders a single field's resolved value as trimmed text.
   * @param {DocsFieldDefinition | undefined} field - the field to render.
   * @returns {string} the trimmed display text ("" when the field is empty).
   */  fieldText(field: DocsFieldDefinition | undefined): string {
    return display(fieldValue(field)).trim();
  }

  /**
   * @description Returns the list of rows the block should render.
   * @summary Prefers an array `value`, then an array `items`, then the first
   * array-valued child field; returns an empty array when none apply.
   * @returns {unknown[]} the resolved row list (never undefined).
   */  get listValue(): unknown[] {
    if (Array.isArray(this.value)) return this.value;
    if (Array.isArray(this.items)) return this.items;
    for (const block of this.blocks) {
      const candidate = fieldValue(block);
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  /**
   * @description Returns the code the block should highlight.
   * @summary Prefers the explicit `code` input, then the value of a
   * "docs.code" child field, then the block value; non-string candidates are
   * displayed via {@link display}.
   * @returns {string} the raw code text to render.
   */  get codeValue(): string {
    if (this.code) return this.code;
    const field = this.child(DocsElements.CODE);
    const candidate = field ? fieldValue(field) : this.value;
    return typeof candidate === "string" ? candidate : display(candidate);
  }

  /**
   * @description Returns the language hint for the block's code.
   * @summary Prefers the explicit `language` input, then the `language` prop of
   * a "docs.code" child field.
   * @returns {string | undefined} the language hint, when resolved.
   */  get languageValue(): string | undefined {
    if (this.language) return this.language;
    const field = this.child(DocsElements.CODE);
    const props = (field?.props ?? {}) as Record<string, unknown>;
    const candidate = props["language"];
    return typeof candidate === "string" ? candidate : undefined;
  }
}
