import type { DocsDatabase } from "../database/DocsDatabase";
import type {
  DocComponentEventModel,
  DocComponentModel,
  DocComponentPreviewModel,
  DocComponentPropertyModel,
  DocExampleModel,
  DocParameterModel,
  DocReferenceModel,
  DocReturnModel,
  DocSignatureModel,
  DocSourceModel,
  DocTagModel,
  DocTutorialModel,
  DocTypeModel,
  DocletModel,
} from "../models";

/**
 * @description In-memory working set of every docs table being published.
 * @summary Holds the model arrays for all persisted collections: doclets and
 * their dependants (tags, types, parameters, returns, signatures, examples,
 * sources, references) plus components and their properties, events and
 * previews, and finally tutorials. Publisher steps mutate these arrays in
 * place, so the dataset instance is both pipeline input and the content
 * persisted back to the DocsDatabase.
 */
export interface PublicationDataset {
  doclets: DocletModel[];
  tags: DocTagModel[];
  types: DocTypeModel[];
  parameters: DocParameterModel[];
  returns: DocReturnModel[];
  signatures: DocSignatureModel[];
  examples: DocExampleModel[];
  sources: DocSourceModel[];
  references: DocReferenceModel[];
  components: DocComponentModel[];
  componentProperties: DocComponentPropertyModel[];
  componentEvents: DocComponentEventModel[];
  componentPreviews: DocComponentPreviewModel[];
  tutorials: DocTutorialModel[];
}

/**
 * @description Loads the full publication working set from the docs database.
 * @summary Selects every docs table in parallel via the database repositories
 * and returns the resulting PublicationDataset with each collection sorted by
 * uid to guarantee deterministic downstream processing.
 * @param {DocsDatabase} database - The initialized docs database to read from.
 * @returns {Promise<PublicationDataset>} The uid-sorted model collections for
 * all tables.
 * @memberOf module:docaf
 */
export async function loadPublicationDataset(
  database: DocsDatabase
): Promise<PublicationDataset> {
  const [
    doclets,
    tags,
    types,
    parameters,
    returns,
    signatures,
    examples,
    sources,
    references,
    components,
    componentProperties,
    componentEvents,
    componentPreviews,
    tutorials,
  ] = await Promise.all([
    database.doclets.select().execute(),
    database.tags.select().execute(),
    database.types.select().execute(),
    database.parameters.select().execute(),
    database.returns.select().execute(),
    database.signatures.select().execute(),
    database.examples.select().execute(),
    database.sources.select().execute(),
    database.references.select().execute(),
    database.components.select().execute(),
    database.componentProperties.select().execute(),
    database.componentEvents.select().execute(),
    database.componentPreviews.select().execute(),
    database.tutorials.select().execute(),
  ]);
  return {
    doclets: sortByUid(doclets),
    tags: sortByUid(tags),
    types: sortByUid(types),
    parameters: sortByUid(parameters),
    returns: sortByUid(returns),
    signatures: sortByUid(signatures),
    examples: sortByUid(examples),
    sources: sortByUid(sources),
    references: sortByUid(references),
    components: sortByUid(components),
    componentProperties: sortByUid(componentProperties),
    componentEvents: sortByUid(componentEvents),
    componentPreviews: sortByUid(componentPreviews),
    tutorials: sortByUid(tutorials),
  };
}

function sortByUid<T extends { uid: string }>(models: T[]): T[] {
  return [...models].sort((a, b) => a.uid.localeCompare(b.uid));
}

/**
 * @description Inserts a model into a collection, replacing any same-uid entry.
 * @summary Finds the first model with the same `uid` and overwrites it in
 * place; if none exists the model is appended. The passed model instance is
 * returned either way, making calls chainable into assignments.
 * @template T - Model type carrying a string `uid`.
 * @param {T[]} models - The collection to update in place.
 * @param {T} model - The model to insert or replace.
 * @returns {T} The inserted or replacement model.
 * @memberOf module:docaf
 */
export function upsert<T extends { uid: string }>(models: T[], model: T): T {
  const index = models.findIndex((candidate) => candidate.uid === model.uid);
  if (index >= 0) models[index] = model;
  else models.push(model);
  return model;
}

/**
 * @description Returns the tags owned by a specific doclet.
 * @summary Filters `dataset.tags` to the records whose `ownerUid` equals the
 * given doclet uid, preserving collection order. Used, for example, to locate
 * `@param`, `@returns` and `@tutorial` tags while building signatures and
 * tutorial links.
 * @param {PublicationDataset} dataset - The dataset holding the tag collection.
 * @param {string} docletUid - Uid of the owning doclet.
 * @returns {DocTagModel[]} The tags owned by the doclet.
 * @memberOf module:docaf
 */
export function tagsFor(
  dataset: PublicationDataset,
  docletUid: string
): DocTagModel[] {
  return dataset.tags.filter((tag) => tag.ownerUid === docletUid);
}
