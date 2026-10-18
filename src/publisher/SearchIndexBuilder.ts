import {
  DocSearchEntryModel,
  DocsIds,
  type DocletModel,
} from "../models";
import type { PublicationDataset } from "./dataset";
import type { LinkRegistry } from "./LinkRegistry";

const TOKEN_LIMIT = 200;
const KIND_RANK: Record<string, number> = {
  component: 9,
  class: 8,
  interface: 7,
  function: 6,
  tutorial: 6,
  module: 5,
  namespace: 5,
  typedef: 4,
  enum: 4,
};

/**
 * Builds stable search entries from doclets, tags and tutorial routes. The
 * runtime query engine owns matching; the generator only publishes tokens and
 * ranking hints.
 */
export class SearchIndexBuilder {
  build(
    dataset: PublicationDataset,
    links: LinkRegistry
  ): DocSearchEntryModel[] {
    const entries: DocSearchEntryModel[] = [];
    for (const doclet of dataset.doclets) {
      if (doclet.metadata?.undocumented === "true") continue;
      const link = links.resolve(doclet.longname);
      if (!link) continue;
      const tags = dataset.tags
        .filter((tag) => tag.ownerUid === doclet.uid)
        .map((tag) => tag.value ?? "");
      entries.push(
        new DocSearchEntryModel({
          uid: DocsIds.search(doclet.uid),
          docletUid: doclet.uid,
          name: doclet.name,
          longname: doclet.longname,
          kind: doclet.componentId ? "component" : doclet.kind,
          category: doclet.category,
          subCategory: doclet.subCategory,
          summary:
            doclet.summary || doclet.description || doclet.classdesc || "",
          route: link.route,
          anchor: link.anchor,
          rank: rankOf(doclet.componentId ? "component" : doclet.kind),
          tokens: this.dedupe(this.tokens(doclet, tags)),
        })
      );
    }
    for (const tutorial of dataset.tutorials) {
      const docletUid = tutorial.docletUids[0];
      entries.push(
        new DocSearchEntryModel({
          uid: DocsIds.search(tutorial.uid),
          docletUid,
          name: tutorial.name,
          longname: tutorial.name,
          kind: "tutorial",
          summary: tutorial.description ?? "",
          route: tutorial.route ?? "",
          rank: rankOf("tutorial"),
          tokens: this.dedupe(
            tokenize(
              [tutorial.title, tutorial.description, tutorial.content].join(" ")
            )
          ),
        })
      );
    }
    return entries.sort(
      (a, b) => b.rank - a.rank || a.longname.localeCompare(b.longname)
    );
  }

  private tokens(
    doclet: DocletModel,
    tags: readonly string[]
  ): string[] {
    const raw = [
      doclet.name,
      doclet.longname,
      doclet.summary,
      doclet.description,
      doclet.classdesc,
      doclet.category,
      doclet.subCategory,
      ...tags,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ");
    return tokenize(raw);
  }

  private dedupe(tokens: string[]): string[] {
    return [...new Set(tokens)].slice(0, TOKEN_LIMIT);
  }
}

function rankOf(kind: string): number {
  return Object.prototype.hasOwnProperty.call(KIND_RANK, kind)
    ? KIND_RANK[kind]
    : 1;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_$]+/g)
    .filter((token) => token.length > 1)
    .map((token) => token.replace(/\$/g, ""));
}
