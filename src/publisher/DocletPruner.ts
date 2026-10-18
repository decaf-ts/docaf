import type { DocletModel } from "../models";

/**
 * @description Flags controlling which doclets the DocletPruner keeps.
 * @summary When `includePrivate` is set, symbols marked `@private`/`@internal`
 * are retained instead of dropped; when `includeUndocumented` is set, symbols
 * without documentation survive pruning. `@ignore`d symbols and non-exported
 * definitions are always removed regardless of these flags.
 */
export interface DocletPrunerOptions {
  includePrivate?: boolean;
  includeUndocumented?: boolean;
}

/**
 * Port of JSDoc's `helper.prune()` behavior used by BetterDocs:
 * drop undocumented symbols, private symbols (unless configured) and
 * ignored symbols, while keeping classes that only exist to host a
 * component signature.
 */
export class DocletPruner {
  constructor(private readonly options: DocletPrunerOptions = {}) {}

  prune(doclets: readonly DocletModel[]): DocletModel[] {
    return doclets.filter((doclet) => this.keep(doclet));
  }

  private keep(doclet: DocletModel): boolean {
    const metadata = doclet.metadata ?? {};
    if (!this.options.includeUndocumented && metadata.undocumented === "true")
      return false;
    if (!this.options.includePrivate && doclet.access === "private")
      return false;
    if (metadata.ignore === "true") return false;
    if (metadata.internal === "true" && !this.options.includePrivate)
      return false;
    if (doclet.kind === "package" || doclet.kind === "file") return false;
    if (metadata.exported === "false") return false;
    return true;
  }
}
