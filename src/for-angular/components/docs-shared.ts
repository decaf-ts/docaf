import type {
  DocsBreadcrumbEntry,
  DocsExampleEntry,
  DocsMemberEntry,
  DocsNavigationEntry,
  DocsParameterEntry,
  DocsReturnEntry,
  DocsSearchEntry,
  DocsSectionEntry,
  DocsSourceViewEntry,
  DocsTableOfContentsView,
} from "../../ui/views/DocsViews";

/**
 * @description A single field definition flowing through the docs component tree.
 * @summary The data-only shape every docs Angular block consumes: a semantic
 * `tag` (e.g. "docs.code") identifying which component renders it, an optional
 * logical `name`, the field `value`, nested `children`, and free-form `props`
 * (e.g. `language` for code fields). Produced by the publisher and hydrated
 * from snapshot records.
 * @interface DocsFieldDefinition
 * @category Components
 * @memberOf module:docaf
 */
export interface DocsFieldDefinition {
  tag: string;
  name?: string;
  value?: unknown;
  children?: DocsFieldDefinition[];
  props?: Record<string, unknown>;
}

/**
 * @description Alias of DocsFieldDefinition for block-typed inputs.
 * @summary Reads better in component inputs and helpers that operate on whole
 * blocks rather than leaf fields.
 * @typedef {DocsFieldDefinition} DocsBlock
 * @category Components
 * @memberOf module:docaf
 */
export type DocsBlock = DocsFieldDefinition;

/**
 * @description Narrows an unknown value into a DocsFieldDefinition.
 * @summary Returns the value only when it is an object carrying a string
 * `tag`; otherwise returns undefined, so callers can filter junk rows safely.
 * @param {unknown} value - candidate value to narrow.
 * @returns {DocsFieldDefinition | undefined} the validated field definition, if any.
 * @function asField
 * @category Components
 * @memberOf module:docaf
 */
export function asField(value: unknown): DocsFieldDefinition | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<DocsFieldDefinition>;
  if (typeof candidate.tag !== "string") return undefined;
  return candidate as DocsFieldDefinition;
}

/**
 * @description Normalizes an unknown value into a list of field definitions.
 * @summary Maps each array entry through {@link asField}, discarding entries
 * that are not well-formed field definitions.
 * @param {unknown} value - candidate list of field definitions.
 * @returns {DocsFieldDefinition[]} the validated fields (empty when the input is not an array).
 * @function asFields
 * @category Components
 * @memberOf module:docaf
 */
export function asFields(value: unknown): DocsFieldDefinition[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asField(item))
    .filter((item): item is DocsFieldDefinition => Boolean(item));
}

/**
 * @description Returns the normalized children of a field definition.
 * @summary Validates the block's `children` through {@link asFields}.
 * @param {DocsFieldDefinition | undefined} block - the block whose children to read.
 * @returns {DocsFieldDefinition[]} the validated child fields (empty when absent).
 * @function childrenOf
 * @category Components
 * @memberOf module:docaf
 */
export function childrenOf(block: DocsFieldDefinition | undefined): DocsFieldDefinition[] {
  return asFields(block?.children);
}

/**
 * @description Finds the first field with the given semantic tag.
 * @summary Linear scan over the validated fields, first match wins.
 * @param {DocsFieldDefinition[] | undefined} fields - fields to search.
 * @param {string} tag - semantic tag to look for (e.g. "docs.code").
 * @returns {DocsFieldDefinition | undefined} the first matching field, if any.
 * @function childByTag
 * @category Components
 * @memberOf module:docaf
 */
export function childByTag(
  fields: DocsFieldDefinition[] | undefined,
  tag: string
): DocsFieldDefinition | undefined {
  return asFields(fields).find((field) => field.tag === tag);
}

/**
 * @description Finds the first field with the given logical name.
 * @summary Matches the field's `name` property or its `props["name"]`.
 * @param {DocsFieldDefinition[] | undefined} fields - fields to search.
 * @param {string} name - logical name to look for.
 * @returns {DocsFieldDefinition | undefined} the first matching field, if any.
 * @function childByName
 * @category Components
 * @memberOf module:docaf
 */
export function childByName(
  fields: DocsFieldDefinition[] | undefined,
  name: string
): DocsFieldDefinition | undefined {
  return asFields(fields).find(
    (field) => field.name === name || field.props?.["name"] === name
  );
}

/**
 * @description Returns every field with the given semantic tag.
 * @summary Filters the validated fields by tag, preserving order.
 * @param {DocsFieldDefinition[] | undefined} fields - fields to search.
 * @param {string} tag - semantic tag to look for.
 * @returns {DocsFieldDefinition[]} all matching fields in order.
 * @function childrenByTag
 * @category Components
 * @memberOf module:docaf
 */
export function childrenByTag(
  fields: DocsFieldDefinition[] | undefined,
  tag: string
): DocsFieldDefinition[] {
  return asFields(fields).filter((field) => field.tag === tag);
}

/**
 * @description Returns the value of the first field with the given semantic tag.
 * @summary Shorthand for `{@link childByTag}(...)?.value`.
 * @param {DocsFieldDefinition[] | undefined} fields - fields to search.
 * @param {string} tag - semantic tag to look for.
 * @returns {unknown} the matching field's value, or undefined when absent.
 * @function valueOf
 * @category Components
 * @memberOf module:docaf
 */
export function valueOf(
  fields: DocsFieldDefinition[] | undefined,
  tag: string
): unknown {
  return childByTag(fields, tag)?.value;
}

/**
 * @description Returns the value of the first field with the given logical name.
 * @summary Shorthand for `{@link childByName}(...)?.value`.
 * @param {DocsFieldDefinition[] | undefined} fields - fields to search.
 * @param {string} name - logical name to look for.
 * @returns {unknown} the matching field's value, or undefined when absent.
 * @function childValue
 * @category Components
 * @memberOf module:docaf
 */
export function childValue(
  fields: DocsFieldDefinition[] | undefined,
  name: string
): unknown {
  return childByName(fields, name)?.value;
}

/**
 * @description Resolves the effective value of a field definition.
 * @summary Prefers `props["value"]` when present, otherwise the field's own
 * `value`; lets publishers override the rendered value without changing shape.
 * @param {DocsFieldDefinition | undefined} field - the field to resolve.
 * @returns {unknown} the effective value, or undefined when the field is absent.
 * @function fieldValue
 * @category Components
 * @memberOf module:docaf
 */
export function fieldValue(field: DocsFieldDefinition | undefined): unknown {
  if (!field) return undefined;
  const props = field.props ?? {};
  if ("value" in props) return props["value"];
  return field.value;
}

/**
 * @description Renders an arbitrary value as human-readable text.
 * @summary Strings pass through; numbers and booleans are stringified; arrays
 * join their displayed items with ", "; objects are pretty-printed as JSON,
 * falling back to `String(value)` for non-serializable input. Null and
 * undefined render as "".
 * @param {unknown} value - value to render.
 * @returns {string} the display text ("" for null/undefined).
 * @function display
 * @category Components
 * @memberOf module:docaf
 */
export function display(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((entry) => display(entry)).join(", ");
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * @description Renders a value as text, collapsing empty output to undefined.
 * @summary Displays the value with {@link display}, trims it, and returns
 * undefined when nothing remains - useful for optional template bindings.
 * @param {unknown} value - value to render.
 * @returns {string | undefined} the trimmed text, or undefined when empty.
 * @function textOf
 * @category Components
 * @memberOf module:docaf
 */
export function textOf(value: unknown): string | undefined {
  const rendered = display(value).trim();
  return rendered.length ? rendered : undefined;
}

/**
 * @description Normalizes an unknown value into an array.
 * @summary Arrays pass through as-is; null and undefined become an empty
 * array; any other value is wrapped in a single-element array.
 * @template T The element type of the resulting array.
 * @param {unknown} value - value to normalize.
 * @returns {T[]} the normalized array.
 * @function asArray
 * @category Components
 * @memberOf module:docaf
 */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === undefined || value === null) return [];
  return [value as T];
}

/**
 * @description Normalizes an unknown value into navigation entries.
 * @summary Filters the normalized array down to object entries, dropping
 * primitives and nulls so templates can bind safely.
 * @param {unknown} value - candidate navigation entries.
 * @returns {DocsNavigationEntry[]} the validated entries.
 * @function asNavigation
 * @category Components
 * @memberOf module:docaf
 */
export function asNavigation(value: unknown): DocsNavigationEntry[] {
  return asArray<DocsNavigationEntry>(value).filter(
    (entry) => Boolean(entry) && typeof entry === "object"
  );
}

/**
 * @description Normalizes an unknown value into breadcrumb entries.
 * @summary Filters the normalized array down to object entries so templates
 * can bind safely.
 * @param {unknown} value - candidate breadcrumb entries.
 * @returns {DocsBreadcrumbEntry[]} the validated entries.
 * @function asBreadcrumbs
 * @category Components
 * @memberOf module:docaf
 */
export function asBreadcrumbs(value: unknown): DocsBreadcrumbEntry[] {
  return asArray<DocsBreadcrumbEntry>(value).filter(
    (entry) => Boolean(entry) && typeof entry === "object"
  );
}

/**
 * @description Normalizes an unknown value into table-of-contents entries.
 * @summary Filters the normalized array down to object entries so templates
 * can bind safely.
 * @param {unknown} value - candidate table-of-contents entries.
 * @returns {DocsTableOfContentsView["items"]} the validated entries.
 * @function asToc
 * @category Components
 * @memberOf module:docaf
 */
export function asToc(value: unknown): DocsTableOfContentsView["items"] {
  return asArray<DocsTableOfContentsView["items"][number]>(value).filter(
    (entry) => Boolean(entry) && typeof entry === "object"
  );
}

/**
 * @description Normalizes an unknown value into page section entries.
 * @summary Filters the normalized array down to object entries so templates
 * can bind safely.
 * @param {unknown} value - candidate section entries.
 * @returns {DocsSectionEntry[]} the validated sections.
 * @function asSections
 * @category Components
 * @memberOf module:docaf
 */
export function asSections(value: unknown): DocsSectionEntry[] {
  return asArray<DocsSectionEntry>(value).filter(
    (entry) => Boolean(entry) && typeof entry === "object"
  );
}

/**
 * @description Normalizes an unknown value into API member rows.
 * @summary Filters the normalized array down to object entries so templates
 * can bind safely.
 * @param {unknown} value - candidate member rows.
 * @returns {DocsMemberEntry[]} the validated members.
 * @function asMembers
 * @category Components
 * @memberOf module:docaf
 */
export function asMembers(value: unknown): DocsMemberEntry[] {
  return asArray<DocsMemberEntry>(value).filter(
    (entry) => Boolean(entry) && typeof entry === "object"
  );
}

/**
 * @description Normalizes an unknown value into signature parameter rows.
 * @summary Filters the normalized array down to object entries so templates
 * can bind safely.
 * @param {unknown} value - candidate parameter rows.
 * @returns {DocsParameterEntry[]} the validated parameters.
 * @function asParameters
 * @category Components
 * @memberOf module:docaf
 */
export function asParameters(value: unknown): DocsParameterEntry[] {
  return asArray<DocsParameterEntry>(value).filter(
    (entry) => Boolean(entry) && typeof entry === "object"
  );
}

/**
 * @description Normalizes an unknown value into signature return rows.
 * @summary Filters the normalized array down to object entries so templates
 * can bind safely.
 * @param {unknown} value - candidate return rows.
 * @returns {DocsReturnEntry[]} the validated returns.
 * @function asReturns
 * @category Components
 * @memberOf module:docaf
 */
export function asReturns(value: unknown): DocsReturnEntry[] {
  return asArray<DocsReturnEntry>(value).filter(
    (entry) => Boolean(entry) && typeof entry === "object"
  );
}

/**
 * @description Normalizes an unknown value into code example rows.
 * @summary Filters the normalized array down to object entries so templates
 * can bind safely.
 * @param {unknown} value - candidate example rows.
 * @returns {DocsExampleEntry[]} the validated examples.
 * @function asExamples
 * @category Components
 * @memberOf module:docaf
 */
export function asExamples(value: unknown): DocsExampleEntry[] {
  return asArray<DocsExampleEntry>(value).filter(
    (entry) => Boolean(entry) && typeof entry === "object"
  );
}

/**
 * @description Normalizes an unknown value into search index entries.
 * @summary Filters the normalized array down to object entries so templates
 * can bind safely.
 * @param {unknown} value - candidate search entries.
 * @returns {DocsSearchEntry[]} the validated entries.
 * @function asSearchEntries
 * @category Components
 * @memberOf module:docaf
 */
export function asSearchEntries(value: unknown): DocsSearchEntry[] {
  return asArray<DocsSearchEntry>(value).filter(
    (entry) => Boolean(entry) && typeof entry === "object"
  );
}

/**
 * @description Narrows an unknown value into a source view entry.
 * @summary Returns the value only when it is an object, so callers can rely on
 * the documented source entry shape.
 * @param {unknown} value - candidate source entry.
 * @returns {DocsSourceViewEntry | undefined} the validated entry, if any.
 * @function asSource
 * @category Components
 * @memberOf module:docaf
 */
export function asSource(value: unknown): DocsSourceViewEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as DocsSourceViewEntry;
}

/**
 * @description Extracts search index entries from a search block.
 * @summary Prefers entries stored directly on the block value, then falls back
 * to the "docs.search.entries" child field's value.
 * @param {DocsFieldDefinition | undefined} block - the search block to read.
 * @returns {DocsSearchEntry[]} the resolved search entries (empty when none).
 * @function searchEntriesFrom
 * @category Components
 * @memberOf module:docaf
 */
export function searchEntriesFrom(
  block: DocsFieldDefinition | undefined
): DocsSearchEntry[] {
  if (!block) return [];
  const direct = asSearchEntries(block.value);
  if (direct.length) return direct;
  const child = childByTag(asFields(block.children), "docs.search.entries");
  return asSearchEntries(child?.value);
}

/**
 * @description Extracts the source view entry from a source block.
 * @summary Prefers an entry stored directly on the block value, then falls
 * back to the "docs.source.view" child field's value.
 * @param {DocsFieldDefinition | undefined} block - the source block to read.
 * @returns {DocsSourceViewEntry | undefined} the resolved source entry, if any.
 * @function sourceFrom
 * @category Components
 * @memberOf module:docaf
 */
export function sourceFrom(
  block: DocsFieldDefinition | undefined
): DocsSourceViewEntry | undefined {
  if (!block) return undefined;
  const direct = asSource(block.value);
  if (direct) return direct;
  const child = childByTag(asFields(block.children), "docs.source.view");
  return asSource(child?.value);
}

/**
 * @description Escapes a string for safe interpolation into HTML.
 * @summary Replaces `&`, `<`, `>`, `"` and `'` with their HTML entities so
 * untrusted text (descriptions, code, labels) cannot inject markup.
 * @param {string} value - raw text to escape.
 * @returns {string} the escaped text.
 * @function escapeHtml
 * @category Components
 * @memberOf module:docaf
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * @description A parsed code fence: code body plus optional language.
 * @summary Result of {@link splitFence} and input of the code highlighter.
 * @interface DocsCodeFence
 * @category Components
 * @memberOf module:docaf
 */
export interface DocsCodeFence {
  code: string;
  language?: string;
}

/**
 * @description Splits a raw source string into a code fence and language.
 * @summary Recognizes an opening ``` fence on the first line, captures its
 * language tag and the fenced body, and trims trailing whitespace. Input
 * without a fence is trimmed and returned with the fallback language.
 * @param {string} source - raw source text, optionally wrapped in a ``` fence.
 * @param {string} [fallback] - language to use when the source declares none.
 * @returns {DocsCodeFence} the code body and resolved language.
 * @function splitFence
 * @category Components
 * @memberOf module:docaf
 */
export function splitFence(source: string, fallback?: string): DocsCodeFence {
  const value = (source ?? "").replace(/\r\n/g, "\n");
  const match = value.match(/^\s*```([^\n`]*)\n([\s\S]*?)(?:\n```\s*)?$/);
  if (!match) return { code: value.replace(/^\n+|\n+$/g, ""), language: fallback };
  return {
    code: match[2].replace(/\n$/, ""),
    language: match[1].trim() || fallback,
  };
}

const KEYWORDS = new Set([
  "abstract",
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "constructor",
  "continue",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "infer",
  "instanceof",
  "interface",
  "is",
  "keyof",
  "let",
  "namespace",
  "new",
  "null",
  "of",
  "override",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "set",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "unknown",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

const TOKEN_PATTERN =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(`(?:\\[\s\S]|[^`\\])*`|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')|\b(0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)/g;

/**
 * @description Renders source code as syntax-highlighted, escaped HTML.
 * @summary Splits the source into a fence via {@link splitFence}, then
 * tokenizes comments, string/template literals, numbers, keywords, types
 * (capitalized identifiers), and call expressions, wrapping each in a
 * `docs-tok-*` span while HTML-escaping all text.
 * @param {string} source - raw code to highlight (may be fenced).
 * @param {string} [fallbackLanguage] - language used when the source declares none.
 * @returns {string} HTML with `docs-tok-*` spans for the highlighted tokens.
 * @function highlightCode
 * @category Components
 * @memberOf module:docaf
 */
export function highlightCode(source: string, fallbackLanguage?: string): string {
  const fence = splitFence(source, fallbackLanguage);
  const code = fence.code;
  let output = "";
  let lastIndex = 0;
  for (const match of code.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    output += escapeHtml(code.slice(lastIndex, index));
    const [token, comment, literal, number, word] = match;
    if (comment) {
      output += `<span class="docs-tok-comment">${escapeHtml(comment)}</span>`;
    } else if (literal) {
      output += `<span class="docs-tok-string">${escapeHtml(literal)}</span>`;
    } else if (number) {
      output += `<span class="docs-tok-number">${escapeHtml(number)}</span>`;
    } else if (word) {
      const rest = code.slice(index + token.length);
      const isCall = /^\s*\(/.test(rest);
      if (KEYWORDS.has(word)) {
        output += `<span class="docs-tok-keyword">${escapeHtml(word)}</span>`;
      } else if (/^[A-Z]/.test(word)) {
        output += `<span class="docs-tok-type">${escapeHtml(word)}</span>`;
      } else if (isCall) {
        output += `<span class="docs-tok-function">${escapeHtml(word)}</span>`;
      } else {
        output += escapeHtml(word);
      }
    }
    lastIndex = index + token.length;
  }
  output += escapeHtml(code.slice(lastIndex));
  return output;
}

/**
 * @description Validates a link href for safe rendering.
 * @summary Accepts absolute http(s)/mailto/tel URLs and relative, root-relative,
 * or fragment hrefs; anything else (e.g. `javascript:`) is rejected so
 * {@link renderMarkdown} can drop the link markup.
 * @param {string} href - candidate href.
 * @returns {string | undefined} the href when safe, otherwise undefined.
 * @memberOf module:docaf
 */
function safeHref(href: string): string | undefined {
  const value = href.trim();
  if (!value) return undefined;
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (/^(\/|#|\.{0,2}\/)/.test(value)) return value;
  return undefined;
}

/**
 * @description Renders inline markdown constructs into HTML.
 * @summary Escapes the source first, then applies code spans, `{@link}`
 * references, safe links, bold, italic, and strikethrough. Used by
 * {@link renderMarkdown} for heading labels, table cells, and paragraphs.
 * @param {string} source - raw inline markdown text.
 * @returns {string} the rendered inline HTML.
 * @memberOf module:docaf
 */
function renderInline(source: string): string {
  let html = escapeHtml(source);
  const codeSpans: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_, code: string) => {
    const token = `@@DOCS_CODE_${codeSpans.length}@@`;
    codeSpans.push(`<code>${code}</code>`);
    return token;
  });
  html = html.replace(
    /\{@link\s+([^}|]+?)(?:\s*\|\s*([^}]+))?\}/g,
    (_, target: string, label?: string) =>
      `<code class="docs-jsdoc-link">${(label ?? target).trim()}</code>`
  );
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (whole, label: string, href: string) => {
      const target = safeHref(href);
      if (!target) return whole;
      const external = /^https?:/i.test(target);
      return `<a href="${target}"${
        external ? ' target="_blank" rel="noopener noreferrer"' : ""
      }>${label}</a>`;
    }
  );
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  html = html.replace(/@@DOCS_CODE_(\d+)@@/g, (_, index: string) => codeSpans[Number(index)]);
  return html;
}

/**
 * @description Converts a heading label into a stable HTML id slug.
 * @summary Lowercases the label, strips markdown emphasis characters, maps
 * non-alphanumeric runs to single dashes, and trims leading/trailing dashes.
 * @param {string} value - heading label to slugify.
 * @returns {string} the slug ("" when nothing remains).
 * @memberOf module:docaf
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * @description Renders a markdown subset into escaped, structured HTML.
 * @summary Supports fenced code blocks (highlighted via {@link highlightCode}),
 * headings (with stable, deduplicated slug ids), horizontal rules, block
 * quotes, pipe tables, ordered and unordered lists, and paragraphs. Inline
 * rendering supports backtick code spans, `{@link ...}` JSDoc references,
 * `[label](href)` links (external links get rel="noopener noreferrer"), bold,
 * italic, and strikethrough. All text is HTML-escaped before inline markup is
 * applied; unsafe link hrefs are dropped.
 * @param {string} source - markdown source to render.
 * @returns {string} the rendered HTML ("" for empty input).
 * @function renderMarkdown
 * @category Components
 * @memberOf module:docaf
 */
export function renderMarkdown(source: string): string {
  const input = (source ?? "").replace(/\r\n/g, "\n").trim();
  if (!input) return "";
  const lines = input.split("\n");
  const output: string[] = [];
  const usedSlugs = new Map<string, number>();
  let index = 0;

  const isTableSeparator = (line: string): boolean =>
    /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);

  const parseCells = (line: string): string[] =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = line.match(/^\s*```([^\n`]*)\s*$/);
    if (fence) {
      const language = fence[1].trim();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      output.push(
        `<pre class="docs-code"><code>${
          highlightCode(body.join("\n"), language)
        }</code></pre>`
      );
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const label = heading[2].replace(/\s+#+\s*$/, "").trim();
      const base = slugify(label) || `section-${index}`;
      const seen = usedSlugs.get(base) ?? 0;
      usedSlugs.set(base, seen + 1);
      const id = seen ? `${base}-${seen + 1}` : base;
      output.push(`<h${level} id="${id}">${renderInline(label)}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1[-\s*_]*$/.test(line)) {
      output.push("<hr />");
      index += 1;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      output.push(
        `<blockquote>${quote
          .map((entry) => `<p>${renderInline(entry)}</p>`)
          .join("")}</blockquote>`
      );
      continue;
    }
    if (index + 1 < lines.length && line.includes("|") && isTableSeparator(lines[index + 1])) {
      const headers = parseCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(parseCells(lines[index]));
        index += 1;
      }
      output.push(
        `<div class="docs-table-wrap"><table class="docs-table"><thead><tr>${headers
          .map((header) => `<th>${renderInline(header)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`
          )
          .join("")}</tbody></table></div>`
      );
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
        index += 1;
      }
      output.push(
        `<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      output.push(
        `<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`
      );
      continue;
    }
    const paragraph: string[] = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*(#{1,6})\s+/.test(lines[index]) &&
      !/^\s*```/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !/^\s*>/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }
  return output.join("\n");
}

/**
 * @description Groups API member rows by kind with display labels.
 * @summary Buckets members by their `kind` (defaulting to "member"), assigns a
 * friendly label per known kind (Methods, Properties, Events, Inputs, ...),
 * and returns the groups sorted alphabetically by label.
 * @param {DocsMemberEntry[]} members - member rows to group.
 * @returns {{ kind: string; label: string; members: DocsMemberEntry[] }[]} the grouped rows.
 * @function groupMembers
 * @category Components
 * @memberOf module:docaf
 */
export function groupMembers(
  members: DocsMemberEntry[]
): { kind: string; label: string; members: DocsMemberEntry[] }[] {
  const groups = new Map<string, DocsMemberEntry[]>();
  for (const member of members) {
    const kind = member.kind || "member";
    const list = groups.get(kind) ?? [];
    list.push(member);
    groups.set(kind, list);
  }
  const labels: Record<string, string> = {
    signature: "Signature",
    function: "Functions",
    method: "Methods",
    constructor: "Constructors",
    property: "Properties",
    accessor: "Accessors",
    getter: "Accessors",
    setter: "Accessors",
    event: "Events",
    input: "Inputs",
    output: "Outputs",
    typedef: "Types",
    enum: "Members",
    member: "Members",
  };
  return [...groups.entries()]
    .map(([kind, list]) => ({
      kind,
      label: labels[kind] ?? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}s`,
      members: list,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
