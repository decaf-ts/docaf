import { DocTutorialModel, DocsIds, type DocletModel } from "../models";
import { upsert, type PublicationDataset } from "./dataset";

/**
 * @description Declarative tutorial definition merged into the dataset.
 * @summary `name` is the required unique tutorial key used for uid and route
 * generation. `title`, `description`, `content` and `sourceFile` override or
 * fill the tutorial record (existing dataset values are kept when omitted),
 * `order` controls display ordering (default 0), and `parentName` links the
 * tutorial into the hierarchy under another named tutorial.
 */
export interface TutorialDefinition {
  name: string;
  title?: string;
  description?: string;
  content?: string;
  sourceFile?: string;
  parentName?: string;
  order?: number;
}

/**
 * @description Construction options for the TutorialBuilder.
 * @summary `tutorials` lists the TutorialDefinition records to merge into (and
 * hierarchy-link within) the dataset; definitions whose name already exists
 * update the existing model instead of replacing it. `basePath` (trailing
 * slash stripped) prefixes the generated `/tutorials/<name>` route.
 */
export interface TutorialBuilderOptions {
  basePath?: string;
  tutorials?: readonly TutorialDefinition[];
}

/**
 * Publication of tutorial hierarchy. Tutorials are data records; the runtime
 * renderer decides how to display them.
 */
export class TutorialBuilder {
  constructor(private readonly options: TutorialBuilderOptions = {}) {}

  build(dataset: PublicationDataset): DocTutorialModel[] {
    const basePath = (this.options.basePath ?? "").replace(/\/$/, "");
    const tutorials = new Map<string, DocTutorialModel>();
    for (const tutorial of dataset.tutorials)
      tutorials.set(tutorial.name, tutorial);

    for (const definition of this.options.tutorials ?? []) {
      const name = definition.name;
      const uid = DocsIds.tutorial(name);
      const existing = tutorials.get(name);
      const model =
        existing ??
        new DocTutorialModel({
          uid,
          name,
          title: definition.title ?? name,
          childUids: [],
          docletUids: [],
        });
      model.title = definition.title ?? model.title ?? name;
      model.description = definition.description ?? model.description;
      model.content = definition.content ?? model.content;
      model.sourceFile = definition.sourceFile ?? model.sourceFile;
      model.order = definition.order ?? model.order ?? 0;
      model.route = `${basePath}/tutorials/${encodeURIComponent(name)}`;
      tutorials.set(name, model);
    }

    for (const tutorial of tutorials.values()) {
      upsert(dataset.tutorials, tutorial);
    }

    for (const definition of this.options.tutorials ?? []) {
      if (!definition.parentName) continue;
      const parent = tutorials.get(definition.parentName);
      const child = tutorials.get(definition.name);
      if (!parent || !child) continue;
      child.parentUid = parent.uid;
      parent.childUids = [...new Set([...parent.childUids, child.uid])];
    }

    this.attachDoclets(dataset, tutorials);
    dataset.tutorials = [...tutorials.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return dataset.tutorials;
  }

  private attachDoclets(
    dataset: PublicationDataset,
    tutorials: Map<string, DocTutorialModel>
  ): void {
    for (const doclet of dataset.doclets) {
      const names = dataset.tags
        .filter(
          (tag) =>
            tag.ownerUid === doclet.uid && tag.name === "tutorial" && tag.value
        )
        .map((tag) => tag.value!.trim());
      if (!names.length) continue;
      const ids: string[] = [];
      for (const name of names) {
        const tutorial = tutorials.get(name);
        if (!tutorial) continue;
        ids.push(tutorial.uid);
        tutorial.docletUids = [...new Set([...tutorial.docletUids, doclet.uid])];
      }
      doclet.tutorialIds = [...new Set([...doclet.tutorialIds, ...ids])];
    }
  }
}

/**
 * @description Filters doclets down to tutorial-kind entries.
 * @summary Returns only the doclets whose `kind` is exactly "tutorial",
 * preserving the input order. Useful for separating tutorial doclets from
 * symbol doclets before publication.
 * @param {DocletModel[]} doclets - The doclets to filter.
 * @returns {DocletModel[]} The doclets of kind "tutorial".
 */
export function tutorialDoclets(
  doclets: readonly DocletModel[]
): DocletModel[] {
  return doclets.filter((doclet) => doclet.kind === "tutorial");
}
