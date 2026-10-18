import type { DocSourceModel } from "../models";
import { upsert, type PublicationDataset } from "./dataset";

/**
 * Publication step 3/10: normalize examples and source locations so pages,
 * references and searches point at stable records. Source text itself is not
 * embedded; only the location metadata is published.
 */
export class SourcePublisher {
  process(dataset: PublicationDataset): DocSourceModel[] {
    const byUid = new Map<string, DocSourceModel>();
    for (const source of dataset.sources) {
      source.fileName = source.fileName.replace(/\\/g, "/");
      source.path = (source.path ?? source.fileName).replace(/\\/g, "/");
      byUid.set(source.uid, source);
    }
    for (const doclet of dataset.doclets) {
      if (!doclet.sourceId) continue;
      const source = byUid.get(doclet.sourceId);
      if (source) doclet.sourceId = source.uid;
    }
    for (const example of dataset.examples) {
      example.caption = example.caption ?? "";
      example.language = example.language ?? "ts";
      example.escaped = example.escaped ?? false;
      upsert(dataset.examples, example);
    }
    dataset.sources = [...byUid.values()].sort((a, b) =>
      a.uid.localeCompare(b.uid)
    );
    return dataset.sources;
  }
}
