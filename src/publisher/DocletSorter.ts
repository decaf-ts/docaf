import type { DocletModel } from "../models";

function compare(a: string | undefined, b: string | undefined): number {
  return (a ?? "").localeCompare(b ?? "");
}

/**
 * BetterDocs sorts the publishable collection with
 * `data.sort('longname, version, since')`. The uid tie-breaker keeps the
 * output deterministic for overloads sharing a longname.
 */
export class DocletSorter {
  sort(doclets: readonly DocletModel[]): DocletModel[] {
    return [...doclets].sort(
      (a, b) =>
        compare(a.longname, b.longname) ||
        compare(a.version, b.version) ||
        compare(a.since, b.since) ||
        compare(a.uid, b.uid)
    );
  }
}
