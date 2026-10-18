import fs from "node:fs";
import path from "node:path";
import type { DocletModel, DocTagModel } from "../../models";
import type { DecafDocsPlugin, DocsSourceContext } from "../types";

function loadTarget(value: string): string {
  return value.replace(/^\s*\{[^}]*\}\s*/, "").trim();
}

function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative.length === 0 ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * @description Options for the hardened `@load` content plugin.
 * @summary Defines the filesystem roots `@load` paths may resolve within, an
 * optional tag resolver used to find `@load` tags on doclets, and an optional
 * cache map for file contents shared across plugin instances.
 */
export interface LoadPluginOptions {
  allowedRoots: readonly string[];
  /**
   * Resolver returning the doclet tags to scan for `@load`; defaults to
   * returning no tags.
   */
  resolveTags?: (doclet: DocletModel) => readonly DocTagModel[];
  /**
   * Optional pre-populated map from resolved file paths to their contents,
   * reused and filled by the plugin to avoid repeated disk reads.
   */
  cache?: Map<string, string>;
}

/**
 * Port of BetterDocs `load.js`, hardened per TDS §20.3: reads are resolved
 * against allowed roots, traversal is rejected, contents are cached and
 * missing files are reported as build diagnostics.
 */
export class LoadPlugin implements DecafDocsPlugin {
  readonly name = "load";
  private readonly roots: string[];
  private readonly cache: Map<string, string>;
  private readonly resolveTags: (doclet: DocletModel) => readonly DocTagModel[];

  constructor(options: LoadPluginOptions) {
    this.roots = options.allowedRoots.map((root) => {
      const resolved = path.resolve(root);
      try {
        return fs.realpathSync(resolved);
      } catch {
        return resolved;
      }
    });
    this.cache = options.cache ?? new Map<string, string>();
    this.resolveTags = options.resolveTags ?? (() => []);
  }

  newDoclet(doclet: DocletModel, source: DocsSourceContext): void {
    const tag = this.resolveTags(doclet).find((candidate) => candidate.name === "load");
    if (!tag || !tag.value) return;
    const requested = loadTarget(tag.value);
    const candidate = path.isAbsolute(requested)
      ? path.resolve(requested)
      : path.resolve(path.dirname(source.filename), requested);
    const resolved = this.resolveWithinRoots(candidate);
    if (!resolved) {
      source.diagnostics.error(
        "DOCAF_LOAD_TRAVERSAL",
        `@load path "${requested}" escapes the allowed documentation roots`,
        doclet.sourceId ? { fileName: source.filename, line: 1, column: 1 } : undefined
      );
      return;
    }
    let content: string;
    try {
      content = this.cache.get(resolved) ?? fs.readFileSync(resolved, "utf8");
      this.cache.set(resolved, content);
    } catch (error) {
      source.diagnostics.error(
        "DOCAF_LOAD_MISSING",
        `@load file "${requested}" does not exist or cannot be read: ${
          (error as Error).message
        }`,
        { fileName: source.filename, line: 1, column: 1 }
      );
      return;
    }
    if (doclet.classdesc) doclet.classdesc = [doclet.classdesc, content].join("\n");
    else if (doclet.description || doclet.kind === "module")
      doclet.description = [doclet.description, content].join("\n");
    doclet.metadata = { ...(doclet.metadata ?? {}), load: content };
  }

  private resolveWithinRoots(candidate: string): string | undefined {
    let real = candidate;
    try {
      real = fs.realpathSync(candidate);
    } catch {
      real = candidate;
    }
    for (const root of this.roots) {
      if (inside(root, real)) return real;
    }
    return undefined;
  }
}
