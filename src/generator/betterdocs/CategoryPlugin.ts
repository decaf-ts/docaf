import type { DocletModel, DocTagModel } from "../../models";
import type { DecafDocsPlugin } from "../types";

/**
 * @description Function used to obtain the raw tag records of a doclet.
 * @summary Given a doclet model, returns the read-only list of `DocTagModel`
 * instances to inspect for `@category` and `@subcategory` tags. The default
 * resolver reads the optional `tags` array carried on the doclet, which allows
 * the pipeline to supply tags from sources other than the doclet itself.
 * @param {DocletModel} doclet - The doclet whose tags should be resolved.
 * @returns {DocTagModel[]} The tags to scan; never null, empty when none exist.
 * @memberOf module:docaf
 */
export type TagResolver = (doclet: DocletModel) => readonly DocTagModel[];

/**
 * Port of BetterDocs `category.js`; behavior is intentionally unchanged.
 */
export class CategoryPlugin implements DecafDocsPlugin {
  readonly name = "category";

  constructor(private readonly resolveTags: TagResolver = defaultTags) {}

  newDoclet(doclet: DocletModel): void {
    const tags = this.resolveTags(doclet);
    if (!tags.length) return;
    const category = tags.find((tag) => tag.name === "category");
    if (category) doclet.category = category.value;
    const subCategory = tags.find((tag) => tag.name === "subcategory");
    if (subCategory) doclet.subCategory = subCategory.value;
  }
}

function defaultTags(doclet: DocletModel): readonly DocTagModel[] {
  return (
    (doclet as unknown as { tags?: DocTagModel[] }).tags ?? []
  );
}
