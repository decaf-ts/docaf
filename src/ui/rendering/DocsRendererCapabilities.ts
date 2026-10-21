/**
 * @description Capabilities a documentation renderer may advertise.
 * @summary Covers layout mechanics (grid, flex, nested), navigation, routing,
 * markdown and code highlighting, search, component previews, responsiveness,
 * and accessibility. Validation rejects a rendering target that cannot realize
 * a required page structure before publication.
 * @typedef {string} DocsRendererCapability
 * @category UI
 * @memberOf module:docaf
 */
export type DocsRendererCapability =
  | "layout.grid"
  | "layout.flex"
  | "layout.nested"
  | "navigation"
  | "routing"
  | "markdown"
  | "code.highlighting"
  | "search"
  | "component.native-preview"
  | "component.iframe-preview"
  | "responsive"
  | "accessibility";

/**
 * @description Minimal capability set every documentation renderer is expected to provide.
 * @summary Requires grid and nested layouts, navigation, routing, markdown,
 * search, and responsive/accessibility support; renderers advertise additional
 * capabilities (such as component previews or code highlighting) on top of it.
 * @const DOCS_BASE_CAPABILITIES
 * @category UI
 * @memberOf module:docaf
 */
export const DOCS_BASE_CAPABILITIES: readonly DocsRendererCapability[] = [
  "layout.grid",
  "layout.nested",
  "navigation",
  "routing",
  "markdown",
  "search",
  "responsive",
  "accessibility",
];

/**
 * @description Result of validating a renderer's capabilities against a requirement set.
 * @summary Lists the required capabilities the target does not support and the
 * alphabetically sorted set of capabilities the target advertises.
 * @interface DocsRendererCapabilityReport
 * @category UI
 * @memberOf module:docaf
 */
export interface DocsRendererCapabilityReport {
  missing: DocsRendererCapability[];
  supported: DocsRendererCapability[];
}

/**
 * @description Validates a renderer's supported capabilities against a required set.
 * @summary Computes which required capabilities the renderer does not support
 * and returns them together with a deduplicated, alphabetically sorted copy of
 * the supported set. A non-empty "missing" list means the target cannot render
 * the required page structure.
 * @param {Iterable<DocsRendererCapability>} required - capabilities the publication requires.
 * @param {Iterable<DocsRendererCapability>} supported - capabilities the renderer advertises.
 * @returns {DocsRendererCapabilityReport} missing and supported capabilities.
 * @function validateDocsRendererCapabilities
 * @category UI
 * @memberOf module:docaf
 */
export function validateDocsRendererCapabilities(
  required: Iterable<DocsRendererCapability>,
  supported: Iterable<DocsRendererCapability>
): DocsRendererCapabilityReport {
  const available = new Set(supported);
  const missing = [...required].filter((capability) => !available.has(capability));
  return {
    missing,
    supported: [...available].sort(),
  };
}
