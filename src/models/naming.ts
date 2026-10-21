import { Metadata } from "@decaf-ts/decoration";
import { Operations } from "@decaf-ts/db-decorators";

/**
 * @description Recursively rewrites `handlers` keys recorded in decoration metadata.
 * @summary Walks the (possibly nested) metadata record of a renamed model and moves the handler
 * map entry keyed by the original class name to the new one, guarding against cycles through
 * `seen`. Used by {@link stableName} so operation hooks keep resolving after a minification-safe
 * rename.
 * @param {Record<string, unknown>} record - Metadata node to migrate in place.
 * @param {string} previous - Original (minified) class name whose handler entry is moved.
 * @param {string} name - Stable class name the handler entry is moved to.
 * @param {Set<unknown>} seen - Visited object references used to break reference cycles.
 * @returns {void}
 * @memberOf module:docaf
 */
function migrateHandlerNames(
  record: Record<string, unknown>,
  previous: string,
  name: string,
  seen: Set<unknown>
): void {
  if (!record || typeof record !== "object" || seen.has(record)) return;
  seen.add(record);
  if (typeof record["handlers"] === "object" && record["handlers"]) {
    const handlers = record["handlers"] as Record<string, unknown>;
    if (previous in handlers) {
      handlers[name] = handlers[previous];
      delete handlers[previous];
    }
  }
  for (const child of Object.values(record))
    migrateHandlerNames(child as Record<string, unknown>, previous, name, seen);
}

/**
 * @description Deep-copies plain-object metadata so it can be re-registered under a new symbol.
 * @summary Recursively clones arrays and plain objects, returning primitives and class instances
 * by reference. Used by {@link stableName} when copying class metadata from the original
 * minified symbol to the stable one without sharing mutable state.
 * @param {unknown} value - The metadata value to clone.
 * @returns {unknown} A deep copy of plain objects/arrays; the input itself otherwise.
 * @memberOf module:docaf
 */
function cloneMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneMetadata);
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const copy: Record<string, unknown> = {};
    Object.keys(value).forEach((key) => {
      copy[key] = cloneMetadata((value as Record<string, unknown>)[key]);
    });
    return copy;
  }
  return value;
}

/**
 * @description Class decorator that pins a model class name before the other class decorators run.
 * @summary Decaf keys decoration metadata by the class source text and name, so production
 * JavaScript minification can collapse distinct docs models onto the same metadata symbol and
 * corrupt table or UI metadata. Applying this decorator closest to the class renames the
 * constructor to a stable logical name and moves already-registered property metadata, its
 * property index, operation-registry entries, and recursive handler names from the original
 * symbol to the stable one. It does not register the model; apply `@model()` above it.
 * @param {string} name - Stable logical class name to use for metadata.
 * @returns {ClassDecorator} The decorator to apply on the model class.
 * @function stableName
 * @category Class Decorators
 * @memberOf module:docaf
 */
export function stableName(name: string): ClassDecorator {
  return (target) => {
    const ctor = target as unknown as { name: string; toString(): string };
    const previous = ctor.name;
    if (previous === name) return;
    const oldSymbol = Symbol.for([ctor.toString(), previous].join(" - "));
    const MetadataStore = Metadata as unknown as {
      innerGet(symbol: symbol): unknown;
      _metadata: Record<symbol, unknown>;
      _propertiesIndex: Record<symbol, Set<string>>;
    };
    const oldMetadata = MetadataStore.innerGet(oldSymbol) as
      | Record<string, unknown>
      | undefined;
    const oldIndex = MetadataStore._propertiesIndex[oldSymbol];
    Object.defineProperty(ctor, "name", {
      value: name,
      configurable: true,
    });
    const registry = (
      Operations as unknown as {
        getOpRegistry(): { cache?: Record<string, unknown> };
      }
    ).getOpRegistry();
    const operations = registry.cache;
    if (operations && operations[previous]) {
      operations[name] = Object.assign(
        {},
        operations[previous],
        operations[name] ?? {}
      );
      delete operations[previous];
    }
    const newSymbol = Symbol.for([ctor.toString(), name].join(" - "));
    if (oldMetadata)
      MetadataStore._metadata[newSymbol] = cloneMetadata(oldMetadata);
    if (oldIndex) MetadataStore._propertiesIndex[newSymbol] = new Set(oldIndex);
    if (MetadataStore._metadata[newSymbol]) {
      migrateHandlerNames(
        MetadataStore._metadata[newSymbol] as Record<string, unknown>,
        previous,
        name,
        new Set()
      );
    }
    delete MetadataStore._metadata[oldSymbol];
    delete MetadataStore._propertiesIndex[oldSymbol];
  };
}
