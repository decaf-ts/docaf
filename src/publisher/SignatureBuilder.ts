import {
  DocParameterModel,
  DocReturnModel,
  DocSignatureModel,
  DocTypeModel,
  DocsIds,
  type DocletModel,
} from "../models";
import {
  tagsFor,
  upsert,
  type PublicationDataset,
} from "./dataset";

/**
 * @description Optionality/nullability flags attachable to a signature item.
 * @summary Mirrors the BetterDocs attribute flags: `optional` renders the
 * "opt" attribute, and a tri-state `nullable` renders "nullable" when true or
 * "non-null" when explicitly false. Consumed by getSignatureAttributes.
 */
export interface SignatureAttributes {
  optional?: boolean;
  nullable?: boolean;
}

/**
 * @description Decides whether a doclet requires a composed signature.
 * @summary Returns true for functions, classes and constructors. For typedefs
 * it is true only when the typedef's type expression is (or includes) the
 * "function" type, case-insensitively. All other kinds return false.
 * @param {DocletModel} doclet - The doclet to test.
 * @returns {boolean} True when a DocSignatureModel should be built for the
 * doclet.
 * @memberOf module:docaf
 */
export function needsSignature(doclet: DocletModel): boolean {
  if (doclet.kind === "function" || doclet.kind === "class") return true;
  if (doclet.kind === "constructor") return true;
  if (doclet.kind === "typedef" && doclet.type) {
    return doclet.type
      .split("|")
      .some((name) => name.trim().toLowerCase() === "function");
  }
  return false;
}

/**
 * @description Collects the BetterDocs signature attribute flags of an item.
 * @summary Maps the optional/nullable flags of a {@link SignatureAttributes}
 * record to the attribute tokens used by signature rendering: `opt` for
 * optional parameters, `nullable`/`non-null` for tri-state nullability.
 * @param {SignatureAttributes} item - The attribute record to read.
 * @returns {string[]} The attribute tokens in canonical order.
 * @memberOf module:docaf
 */
export function getSignatureAttributes(
  item: SignatureAttributes
): string[] {
  const attributes: string[] = [];
  if (item.optional) attributes.push("opt");
  if (item.nullable === true) attributes.push("nullable");
  else if (item.nullable === false) attributes.push("non-null");
  return attributes;
}

const PARAM_TAG =
  /^\{([^}]*)\}\s*(\[[^\]]+\]|\S+)?\s*(.*)$/s;

interface ParsedParameter {
  name: string;
  typeText: string;
  optional: boolean;
  defaultValue?: string;
  description?: string;
}

function parseParamTag(value: string | undefined): ParsedParameter | undefined {
  if (!value) return undefined;
  const match = value.match(PARAM_TAG);
  if (!match) return undefined;
  let name = (match[2] ?? "").trim();
  let defaultValue: string | undefined;
  let optional = false;
  if (name.startsWith("[") && name.endsWith("]")) {
    optional = true;
    name = name.slice(1, -1);
  }
  const equals = name.indexOf("=");
  if (equals >= 0) {
    defaultValue = name.slice(equals + 1);
    name = name.slice(0, equals);
  }
  if (!name) return undefined;
  return {
    name,
    typeText: match[1].trim(),
    optional,
    defaultValue,
    description: (match[3] ?? "").trim() || undefined,
  };
}

function parseReturnTag(
  value: string | undefined
): { typeText: string; description?: string } | undefined {
  if (!value) return undefined;
  const match = value.match(/^\{([^}]*)\}\s*(.*)$/s);
  if (!match) return { typeText: value.trim() };
  return {
    typeText: match[1].trim(),
    description: (match[2] ?? "").trim() || undefined,
  };
}

function parameterText(parameter: DocParameterModel): string {
  return [
    parameter.rest ? "..." : "",
    parameter.name,
    parameter.optional ? "?" : "",
    parameter.typeText ? `: ${parameter.typeText}` : "",
  ].join("");
}

/**
 * @description Composes the display signature and parameter texts.
 * @summary Renders each parameter as "...name?: type" via its model fields,
 * joins them with ", " and builds "prefix name(params)" where `prefix` is the
 * space-joined modifier list (e.g. "static async"). A return type annotation
 * ": returnType" is appended unless the kind is a constructor/class or no
 * return type is given.
 * @param {string} name - The symbol name rendered before the parameter list.
 * @param {string} kind - The doclet kind; "constructor" and "class" suppress
 * the return type annotation.
 * @param {DocParameterModel[]} parameters - Ordered parameter models
 * providing rest/optional/type text.
 * @param {string|undefined} returnType - Optional return type text to append.
 * @param {string[]} modifiers - Signature prefixes such as "static",
 * "async", "abstract"; defaults to none.
 * @returns {{signatureText: string, parametersText: string}} The composed full
 * signature text and the bare parameter list text.
 * @memberOf module:docaf
 */
export function composeSignature(
  name: string,
  kind: string,
  parameters: readonly DocParameterModel[],
  returnType: string | undefined,
  modifiers: readonly string[] = []
): { signatureText: string; parametersText: string } {
  const parametersText = parameters.map(parameterText).join(", ");
  const prefix = modifiers.length ? `${modifiers.join(" ")} ` : "";
  const isConstructor = kind === "constructor" || kind === "class";
  const signatureText = `${prefix}${name}(${parametersText})${
    isConstructor || !returnType ? "" : `: ${returnType}`
  }`;
  return { signatureText, parametersText };
}

function ensureType(
  dataset: PublicationDataset,
  ownerUid: string,
  role: string,
  index: number,
  text: string
): DocTypeModel | undefined {
  if (!text) return undefined;
  const uid = DocsIds.type(ownerUid, role, index);
  const existing = dataset.types.find((type) => type.uid === uid);
  if (existing) {
    existing.text = text;
    existing.normalized = text.replace(/\s+/g, " ").trim();
    return existing;
  }
  const type = new DocTypeModel({
    uid,
    ownerUid,
    role,
    index,
    text,
    normalized: text.replace(/\s+/g, " ").trim(),
    kind: "inline",
    arguments: [],
  });
  return upsert(dataset.types, type);
}

/**
 * Port of BetterDocs' `needsSignature`, `addSignatureParams`,
 * `addSignatureReturns`, `addSignatureTypes` and `addAttribs` as structured
 * models. No HTML is produced.
 */
export class SignatureBuilder {
  process(dataset: PublicationDataset): void {
    const ordered = [...dataset.doclets].sort(
      (a, b) => a.uid.localeCompare(b.uid)
    );
    for (const doclet of ordered) {
      if (!needsSignature(doclet) && !doclet.signatureIds.length) {
        if (doclet.type)
          ensureType(dataset, doclet.uid, "type", 0, doclet.type);
        continue;
      }
      this.buildOne(dataset, doclet);
    }
    dataset.signatures.sort((a, b) => a.uid.localeCompare(b.uid));
    dataset.parameters.sort((a, b) => a.uid.localeCompare(b.uid));
    dataset.returns.sort((a, b) => a.uid.localeCompare(b.uid));
    dataset.types.sort((a, b) => a.uid.localeCompare(b.uid));
  }

  private buildOne(dataset: PublicationDataset, doclet: DocletModel): void {
    const signatureUid = DocsIds.signature(doclet.uid, 0);
    let signature = dataset.signatures.find(
      (candidate) => candidate.uid === signatureUid
    );
    if (!signature) {
      signature = new DocSignatureModel({
        uid: signatureUid,
        docletUid: doclet.uid,
        index: 0,
        kind: doclet.kind === "class" ? "constructor" : "function",
        name: doclet.name,
        parameterIds: [],
        typeIds: [],
        referenceIds: [],
      });
      upsert(dataset.signatures, signature);
    }

    let parameters = dataset.parameters
      .filter((parameter) => parameter.signatureUid === signatureUid)
      .sort((a, b) => a.index - b.index);
    const returnModelUid = DocsIds.returns(signatureUid, "returns");
    let returns = dataset.returns.find(
      (candidate) => candidate.uid === returnModelUid
    );

    if (!parameters.length) {
      parameters = this.parametersFromTags(dataset, doclet, signatureUid);
    }
    if (!returns) {
      returns = this.returnFromTags(dataset, doclet, signatureUid);
    }

    for (const parameter of parameters) {
      const type = ensureType(
        dataset,
        doclet.uid,
        "parameter",
        parameter.index,
        parameter.typeText ?? ""
      );
      if (type) parameter.typeId = type.uid;
      upsert(dataset.parameters, parameter);
    }

    const returnType = returns?.typeText;
    if (returns) {
      const type = ensureType(
        dataset,
        doclet.uid,
        "returns",
        0,
        returns.typeText ?? ""
      );
      if (type) returns.typeId = type.uid;
      upsert(dataset.returns, returns);
    }

    const modifiers = this.modifiersOf(doclet);
    const composed = composeSignature(
      doclet.name,
      doclet.kind,
      parameters,
      returnType,
      modifiers
    );
    signature.docletUid = doclet.uid;
    signature.index = 0;
    signature.kind =
      doclet.kind === "class" || doclet.kind === "constructor"
        ? "constructor"
        : "function";
    signature.name = doclet.name;
    signature.signatureText = composed.signatureText;
    signature.parametersText = composed.parametersText;
    signature.access = doclet.access;
    signature.description = doclet.description;
    signature.static = doclet.metadata?.static === "true";
    signature.async = doclet.async;
    signature.abstract = doclet.abstract;
    signature.virtual = doclet.virtual;
    signature.parameterIds = parameters.map((parameter) => parameter.uid);
    signature.returnId = returns?.uid;
    signature.typeIds = [
      ...parameters
        .map((parameter) => parameter.typeId)
        .filter((uid): uid is string => Boolean(uid)),
      ...(returns?.typeId ? [returns.typeId] : []),
    ];
    upsert(dataset.signatures, signature);
    doclet.signatureIds = [signature.uid];
    if (doclet.type)
      ensureType(dataset, doclet.uid, "type", 0, doclet.type);
  }

  private modifiersOf(doclet: DocletModel): string[] {
    const modifiers: string[] = [];
    if (doclet.metadata?.static === "true") modifiers.push("static");
    if (doclet.async) modifiers.push("async");
    if (doclet.abstract) modifiers.push("abstract");
    return modifiers;
  }

  private parametersFromTags(
    dataset: PublicationDataset,
    doclet: DocletModel,
    signatureUid: string
  ): DocParameterModel[] {
    const parsed = tagsFor(dataset, doclet.uid)
      .filter((tag) => tag.name === "param")
      .map((tag) => parseParamTag(tag.value))
      .filter((value): value is ParsedParameter => Boolean(value));
    return parsed.map((parameter, index) => {
      const model = new DocParameterModel({
        uid: DocsIds.parameter(signatureUid, index),
        signatureUid,
        name: parameter.name,
        index,
        typeText: parameter.typeText,
        optional: parameter.optional,
        rest: parameter.name.startsWith("..."),
        defaultValue: parameter.defaultValue,
        description: parameter.description,
      });
      return upsert(dataset.parameters, model);
    });
  }

  private returnFromTags(
    dataset: PublicationDataset,
    doclet: DocletModel,
    signatureUid: string
  ): DocReturnModel | undefined {
    const tag = tagsFor(dataset, doclet.uid).find(
      (candidate) =>
        candidate.name === "return" || candidate.name === "returns"
    );
    const parsed = parseReturnTag(tag?.value) ?? (doclet.type
      ? { typeText: doclet.type }
      : undefined);
    if (!parsed) return undefined;
    const model = new DocReturnModel({
      uid: DocsIds.returns(signatureUid, "returns"),
      signatureUid,
      role: "returns",
      typeText: parsed.typeText,
      description: parsed.description,
    });
    return upsert(dataset.returns, model);
  }
}
