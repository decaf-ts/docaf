import { Metadata } from "@decaf-ts/decoration";
import { Operations } from "@decaf-ts/db-decorators";
import { Model, model, type ModelArg } from "@decaf-ts/decorator-validation";

/**
 * @description Abstract base class for all documentation models stored in the docs snapshot tables.
 * @summary Extends the Decaf {@link Model} base to participate in the Decaf persistence layer while
 * leaving the identity contract to concrete subclasses. Every concrete docs model (doclets, tags,
 * publication artifacts, component metadata, ...) extends this class and declares its own `uid`
 * primary key, which is a deterministic composite id produced by {@link DocsIds}.
 * @class DocsModel
 */
export abstract class DocsModel extends Model {
  /**
   * @description Deterministic unique identifier for the record, composed from the record kind and
   * its natural key parts via the {@link DocsIds} helpers.
   */
  abstract uid: string;

  protected constructor(arg?: ModelArg<DocsModel>) {
    super(arg);
  }
}

/**
 * @description Discriminator for the kind of documentation record a composite id refers to.
 * @summary Used as the first segment of every composite id built by {@link DocsIds}, so ids can be
 * traced back to their table/model without inspecting the record itself. One literal per docs table
 * (e.g. `"doclet"`, `"tag"`, `"component-preview"`, `"manifest"`).
 */
export type DocsIdKind =
  | "doclet"
  | "tag"
  | "type"
  | "parameter"
  | "return"
  | "signature"
  | "example"
  | "source"
  | "reference"
  | "component"
  | "component-property"
  | "component-event"
  | "component-preview"
  | "tutorial"
  | "page"
  | "section"
  | "route"
  | "link"
  | "navigation"
  | "navigation-item"
  | "search"
  | "lookup"
  | "layout"
  | "manifest";

function part(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function join(kind: DocsIdKind, ...values: Array<string | number | undefined>): string {
  return [kind, ...values.map(part)].filter((value) => value.length > 0).join(":");
}

/**
 * @description Builders for the deterministic composite unique ids used as primary keys by all docs models.
 * @summary Each builder joins a {@link DocsIdKind} discriminator with the record's natural key parts
 * using `:` as separator, after trimming and whitespace-collapsing each part and dropping empty ones
 * (so optional parts vanish instead of producing empty segments). Ids are stable across builds as
 * long as the natural keys are, which makes snapshot records portable and comparable.
 * @example
 * DocsIds.doclet("my-package", "my-package.Ns.Class#method"); // "doclet:my-package:my-package.Ns.Class#method"
 * DocsIds.signature("doclet:my-package:Foo", 0); // "signature:doclet:my-package:Foo:0"
 */
export const DocsIds = {
  doclet(packageName: string, symbolPath: string): string {
    return join("doclet", packageName, symbolPath);
  },

  member(
    packageName: string,
    ownerPath: string,
    memberName: string,
    overload = 0
  ): string {
    return join("doclet", packageName, `${ownerPath}#${part(memberName)}:${part(overload)}`);
  },

  tag(ownerUid: string, name: string, index = 0): string {
    return join("tag", ownerUid, name, index);
  },

  type(ownerUid: string, role: string, index = 0): string {
    return join("type", ownerUid, role, index);
  },

  parameter(signatureUid: string, index: number): string {
    return join("parameter", signatureUid, index);
  },

  returns(signatureUid: string, role: "returns" | "yields" = "returns"): string {
    return join("return", signatureUid, role);
  },

  signature(docletUid: string, index = 0): string {
    return join("signature", docletUid, index);
  },

  example(ownerUid: string, index = 0): string {
    return join("example", ownerUid, index);
  },

  source(
    packageName: string,
    fileName: string,
    line?: number,
    column?: number
  ): string {
    return join("source", packageName, fileName, line, column);
  },

  reference(ownerUid: string, target: string, role: string, index = 0): string {
    return join("reference", ownerUid, role, target, index);
  },

  component(framework: string, sourceFile: string, exportName: string): string {
    return join("component", framework, `${part(sourceFile)}#${part(exportName)}`);
  },

  componentProperty(componentUid: string, name: string): string {
    return join("component-property", componentUid, name);
  },

  componentEvent(componentUid: string, name: string): string {
    return join("component-event", componentUid, name);
  },

  componentPreview(componentUid: string, name = "default"): string {
    return join("component-preview", componentUid, name);
  },

  tutorial(name: string): string {
    return join("tutorial", name);
  },

  page(key: string): string {
    return join("page", key);
  },

  section(pageUid: string, key: string): string {
    return join("section", pageUid, key);
  },

  route(route: string): string {
    return join("route", route);
  },

  link(sourceUid: string, target: string, role: string): string {
    return join("link", sourceUid, role, target);
  },

  navigation(root = "main"): string {
    return join("navigation", root);
  },

  navigationItem(navigationUid: string, path: string): string {
    return join("navigation-item", navigationUid, path);
  },

  search(docletUid: string): string {
    return join("search", docletUid);
  },

  lookup(lookupKind: string, value: string): string {
    return join("lookup", lookupKind, value);
  },

  layout(name: string): string {
    return join("layout", name);
  },

  manifest(projectName: string, buildId: string): string {
    return join("manifest", projectName, buildId);
  },
} as const;

function migrateHandlerNames(
  value: unknown,
  previous: string,
  name: string,
  seen: Set<unknown>
): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  const record = value as Record<string, unknown>;
  const handlers = record.handlers;
  if (handlers && typeof handlers === "object") {
    const entries = handlers as Record<string, unknown>;
    if (previous in entries) {
      entries[name] = entries[previous];
      delete entries[previous];
    }
  }
  for (const child of Object.values(record))
    migrateHandlerNames(child, previous, name, seen);
}

function cloneMetadata(value: any): any {
  if (Array.isArray(value)) return value.map(cloneMetadata);
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const copy: Record<string, any> = {};
    Object.keys(value).forEach((key) => {
      copy[key] = cloneMetadata(value[key]);
    });
    return copy;
  }
  return value;
}

/**
 * @description Class decorator that applies `@model()` under a given logical name, remapping any
 * metadata already registered under the original class name.
 * @summary Renames the class constructor to `name`, moves operation-registry entries and cloned
 * decoration metadata (including property indexes and recursive `handlers` name maps) from the
 * original class name's metadata symbol to the new one, then delegates to `model()`. Used because
 * docs models are declared with their production class names but must be registered under stable
 * logical names (e.g. `@docsModel("DocletModel")`) so metadata survives minification or renaming.
 * @param {string} name - Logical model name to register the class under.
 * @returns {ClassDecorator} The decorator to apply on the model class.
 */
export function docsModel(name: string): ClassDecorator {
  return (target) => {
    const ctor = target as unknown as { name: string; toString(): string };
    const previous = ctor.name;
    const oldSymbol = Symbol.for([ctor.toString(), previous].join(" - "));
    const MetadataStore = Metadata as any;
    const oldMetadata = MetadataStore.innerGet(oldSymbol);
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
    if (operations && previous !== name && operations[previous]) {
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
    if (previous !== name && MetadataStore._metadata[newSymbol]) {
      migrateHandlerNames(
        MetadataStore._metadata[newSymbol],
        previous,
        name,
        new Set()
      );
    }
    const decorated = model()(target as never) as never;
    if (Symbol.keyFor(oldSymbol) !== Symbol.keyFor(newSymbol)) {
      delete MetadataStore._metadata[oldSymbol];
      delete MetadataStore._propertiesIndex[oldSymbol];
    }
    return decorated;
  };
}
