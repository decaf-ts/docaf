import path from "node:path";
import {
  DocComponentModel,
  DocExampleModel,
  DocParameterModel,
  DocReferenceModel,
  DocReturnModel,
  DocSignatureModel,
  DocSourceModel,
  DocTagModel,
  DocTypeModel,
  DocletModel,
  DocsIds,
} from "../../models";
import { commonDirectory } from "../paths";
import type {
  ComponentExtraction,
  ConvertedDeclaration,
  ConvertedExample,
  ConvertedMember,
  ConvertedParameter,
  ConvertedProperty,
  ConvertedTag,
  DocletEmitter,
  DocsSourceContext,
  SourceLocation,
} from "../types";
import type { GeneratedDocsStore } from "../store";

const PRIMITIVES = new Set([
  "string",
  "number",
  "boolean",
  "bigint",
  "symbol",
  "unknown",
  "any",
  "void",
  "never",
  "object",
  "null",
  "undefined",
  "this",
]);

function simpleReference(typeText: string | undefined): string | undefined {
  if (!typeText) return undefined;
  const match = typeText.match(/^([A-Za-z_$][\w$]*)$/);
  if (!match) return undefined;
  if (PRIMITIVES.has(match[1])) return undefined;
  return match[1];
}

function relativeFile(
  filename: string,
  context: DocsSourceContext
): string {
  const root = commonDirectory(context.rootNames);
  const relative = path.relative(root, path.resolve(filename));
  return relative.split(path.sep).join("/") || path.basename(filename);
}

/**
 * @description Production emitter: every extracted fact becomes a Decaf model that is
 * persisted through repositories by the pipeline's store.
 * @summary Implements {@link DocletEmitter}: declarations convert to `DocletModel` records
 * with their tags, examples, parameters, signatures, sources and references; class members
 * nest under their owner, and component extractions emit the component/property/event models.
 * @class DecafModelWriter
 */
export class DecafModelWriter implements DocletEmitter {
  constructor(
    private readonly store: GeneratedDocsStore,
    private readonly packageName: string
  ) {}

  emitDeclaration(
    declaration: ConvertedDeclaration,
    source: DocsSourceContext
  ): DocletModel {
    return this.emit(declaration, undefined, source);
  }

  emitMember(
    declaration: ConvertedDeclaration,
    member: ConvertedMember,
    owner: DocletModel,
    source: DocsSourceContext
  ): DocletModel {
    return this.emit(declaration, member, source, owner);
  }

  emitComponent(
    doclet: DocletModel,
    extraction: ComponentExtraction
  ): DocComponentModel {
    const component =
      extraction.component ??
      new DocComponentModel({
        uid: DocsIds.component(
          extraction.framework,
          extraction.sourceFile,
          extraction.exportName
        ),
        docletUid: doclet.uid,
        framework: extraction.framework,
        name: extraction.name,
        exportName: extraction.exportName,
        sourceFile: extraction.sourceFile,
        selector: extraction.selector,
        standalone: extraction.standalone,
        propertyUids: [],
        eventUids: [],
        previewUids: [],
      });
    component.docletUid = doclet.uid;
    component.framework = extraction.framework;
    component.name = extraction.name;
    component.exportName = extraction.exportName;
    component.sourceFile = extraction.sourceFile;
    component.selector = extraction.selector;
    component.standalone = extraction.standalone;
    component.propertyUids = extraction.properties.map(
      (property) => property.uid
    );
    component.eventUids = extraction.events.map((event) => event.uid);
    this.store.add("components", component);
    for (const property of extraction.properties) {
      property.componentUid = component.uid;
      this.store.add("componentProperties", property);
    }
    for (const event of extraction.events) {
      event.componentUid = component.uid;
      this.store.add("componentEvents", event);
    }
    doclet.componentId = component.uid;
    this.store.add("doclets", doclet);
    return component;
  }

  private emit(
    declaration: ConvertedDeclaration,
    member: ConvertedMember | undefined,
    context: DocsSourceContext,
    owner?: DocletModel
  ): DocletModel {
    const isMember = member !== undefined;
    const name = isMember ? member.name : declaration.name;
    const longname = isMember ? member.longname : declaration.longname;
    const uid = isMember
      ? this.memberUid(declaration, member, owner)
      : DocsIds.doclet(this.packageName, symbolPath(declaration));
    const sourceRecord = this.sourceRecord(
      member?.location ?? declaration.location,
      context
    );
    const doclet = new DocletModel({
      uid,
      name,
      longname,
      kind: isMember
        ? member.kind === "constructor"
          ? "constructor"
          : member.kind
        : declaration.kind,
      package: this.packageName,
      memberof: isMember
        ? declaration.longname
        : memberOfLongname(declaration.tags),
      memberofUid: isMember ? owner?.uid : undefined,
      scope: isMember
        ? member.static
          ? "static"
          : "instance"
        : "global",
      description: isMember ? member.description : declaration.description,
      classdesc: isMember ? undefined : declaration.classdesc,
      summary: (isMember ? member.description : declaration.description)
        ?.split("\n")[0]
        ?.trim(),
      access: isMember ? member.access : declaration.access,
      readonly: isMember ? member.readonly : declaration.readonly,
      abstract: isMember ? member.abstract : declaration.abstract,
      async: isMember ? member.async : declaration.async,
      virtual: isMember ? member.virtual : declaration.virtual,
      deprecated: isMember ? undefined : declaration.deprecated,
      since: isMember ? undefined : declaration.since,
      version: isMember ? undefined : declaration.version,
      type: isMember ? member.type : declaration.type,
      order: isMember ? member.order : declaration.order,
      sourceId: sourceRecord?.uid,
      augments: isMember ? [] : declaration.augments,
      implements: isMember ? [] : declaration.implementsList,
      metadata: this.metadata(declaration, member),
    });

    this.store.add("doclets", doclet);
    if (sourceRecord) this.store.add("sources", sourceRecord);

    const tags = isMember ? member.tags : declaration.tags;
    const examples = isMember ? member.examples : declaration.examples;
    const parameters = isMember ? member.parameters : declaration.parameters;
    const returnType = isMember ? member.returnType : declaration.returnType;
    const properties = isMember ? member.properties : declaration.properties;

    const tagModels = this.emitTags(doclet, tags);
    doclet.tagIds = tagModels.map((tag) => tag.uid);
    const exampleModels = this.emitExamples(
      doclet,
      examples,
      member ? member.description : declaration.description
    );
    doclet.exampleIds = exampleModels.map((example) => example.uid);

    const includesSignature =
      (!isMember &&
        ["class", "function", "typedef"].includes(declaration.kind)) ||
      (isMember && ["function", "constructor"].includes(member.kind));
    if (includesSignature) {
      const signature = this.emitSignature(
        doclet,
        isMember ? member.kind : declaration.kind,
        parameters,
        returnType,
        isMember ? member : declaration
      );
      doclet.signatureIds = [signature.uid];
    }

    if (!includesSignature) {
      const typeText = isMember ? member!.type : declaration.type;
      if (typeText) {
        const type = this.typeRecord(
          doclet.uid,
          "type",
          0,
          typeText
        );
        if (type) doclet.typeIds = [type.uid];
      }
    }

    for (const property of properties)
      this.emitPropertyTag(doclet, property);

    const references = this.emitReferences(
      doclet,
      tags,
      declaration,
      member
    );
    doclet.referenceIds = references.map((reference) => reference.uid);

    this.store.add("doclets", doclet);
    return doclet;
  }

  private memberUid(
    declaration: ConvertedDeclaration,
    member: ConvertedMember,
    owner: DocletModel | undefined
  ): string {
    if (owner) return `${owner.uid}#${member.name}:${member.order}`;
    return `${DocsIds.doclet(
      this.packageName,
      symbolPath(declaration)
    )}#${member.name}:${member.order}`;
  }

  private metadata(
    declaration: ConvertedDeclaration,
    member: ConvertedMember | undefined
  ): Record<string, string> {
    const metadata: Record<string, string> = {};
    if (member?.optional || declaration.optional)
      metadata.optional = "true";
    if (declaration.exportName)
      metadata.exportName = declaration.exportName;
    const decorators = member?.decorators ?? declaration.decorators;
    if (decorators.length) metadata.decorators = decorators.join(",");
    return metadata;
  }

  private sourceRecord(
    location: SourceLocation | undefined,
    context: DocsSourceContext
  ): DocSourceModel | undefined {
    if (!location) return undefined;
    const fileName = relativeFile(location.fileName, context);
    return new DocSourceModel({
      uid: DocsIds.source(
        this.packageName,
        fileName,
        location.line,
        location.column
      ),
      package: this.packageName,
      fileName,
      path: fileName,
      line: location.line,
      column: location.column,
    });
  }

  private emitTags(
    owner: DocletModel,
    tags: readonly ConvertedTag[]
  ): DocTagModel[] {
    return tags.map(
      (tag, index) =>
        new DocTagModel({
          uid: DocsIds.tag(owner.uid, tag.title, index),
          ownerUid: owner.uid,
          name: tag.title,
          value: tag.value,
          originalValue: tag.originalValue ?? tag.value,
          kind: tag.kind ?? tag.title,
          comment: tag.comment,
        })
    ).map((tag) => this.store.add("tags", tag));
  }

  private emitExamples(
    owner: DocletModel,
    examples: readonly ConvertedExample[],
    fallbackCaption?: string
  ): DocExampleModel[] {
    return examples.map(
      (example, index) =>
        new DocExampleModel({
          uid: DocsIds.example(owner.uid, index),
          ownerUid: owner.uid,
          index,
          caption: example.caption ?? (index === 0 ? fallbackCaption : undefined),
          code: example.code,
          language: example.language,
          escaped: false,
        })
    ).map((example) => this.store.add("examples", example));
  }

  private emitSignature(
    owner: DocletModel,
    kind: string,
    parameters: readonly ConvertedParameter[],
    returnType: string | undefined,
    declaration: ConvertedDeclaration | ConvertedMember
  ): DocSignatureModel {
    const signatureUid = DocsIds.signature(owner.uid, 0);
    const signature = new DocSignatureModel({
      uid: signatureUid,
      docletUid: owner.uid,
      index: 0,
      kind:
        kind === "constructor" || kind === "class"
          ? "constructor"
          : "function",
      name: owner.name,
      access:
        (declaration as ConvertedMember).access ??
        (declaration as ConvertedDeclaration).access,
      description: owner.description,
      static: (declaration as ConvertedMember).static,
      async: (declaration as ConvertedMember).async,
      abstract: (declaration as ConvertedMember).abstract,
      virtual: (declaration as ConvertedMember).virtual,
      parameterIds: [],
      returnId: undefined,
      typeIds: [],
      referenceIds: [],
    });
    const parameterModels: DocParameterModel[] = [];
    parameters.forEach((parameter, index) => {
      const type = this.typeRecord(
        owner.uid,
        "parameter",
        index,
        parameter.typeText
      );
      const model = new DocParameterModel({
        uid: DocsIds.parameter(signatureUid, index),
        signatureUid,
        name: parameter.name,
        index,
        typeText: parameter.typeText,
        typeId: type?.uid,
        optional: parameter.optional,
        rest: parameter.rest,
        defaultValue: parameter.defaultValue,
        description: parameter.description,
      });
      this.store.add("parameters", model);
      if (type) this.store.add("types", type);
      parameterModels.push(model);
    });
    signature.parameterIds = parameterModels.map(
      (parameter) => parameter.uid
    );
    signature.parametersText = parameters
      .map((parameter) =>
        [
          parameter.rest ? "..." : "",
          parameter.name,
          parameter.optional ? "?" : "",
          parameter.typeText ? `: ${parameter.typeText}` : "",
        ].join("")
      )
      .join(", ");
    if (returnType) {
      const type = this.typeRecord(
        owner.uid,
        "returns",
        0,
        returnType
      );
      const model = new DocReturnModel({
        uid: DocsIds.returns(signatureUid, "returns"),
        signatureUid,
        role: "returns",
        typeText: returnType,
        typeId: type?.uid,
      });
      this.store.add("returns", model);
      if (type) this.store.add("types", type);
      signature.returnId = model.uid;
    }
    const functionKind = kind !== "constructor" && kind !== "class";
    signature.signatureText = functionKind
      ? `${owner.name}(${signature.parametersText})${returnType ? `: ${returnType}` : ""}`
      : `${owner.name}(${signature.parametersText})`;
    this.store.add("signatures", signature);
    return signature;
  }

  private typeRecord(
    ownerUid: string,
    role: string,
    index: number,
    typeText: string
  ): DocTypeModel | undefined {
    if (!typeText) return undefined;
    const reference = simpleReference(typeText);
    const existing = this.store.get<DocTypeModel>("types").find(
      (type) =>
        type.ownerUid === ownerUid &&
        type.role === role &&
        type.index === index
    );
    if (existing) {
      existing.text = typeText;
      existing.referenceLongname = reference
        ? `${this.packageName}.${reference}`
        : undefined;
      return existing;
    }
    const model = new DocTypeModel({
      uid: DocsIds.type(ownerUid, role, index),
      ownerUid,
      role,
      index,
      text: typeText,
      normalized: typeText.replace(/\s+/g, " ").trim(),
      kind: reference ? "reference" : "inline",
      referenceLongname: reference
        ? `${this.packageName}.${reference}`
        : undefined,
      arguments: [],
      nullable:
        typeText.includes("null") || typeText.includes("undefined")
          ? true
          : undefined,
      optional: typeText.includes("?") ? true : undefined,
    });
    this.store.add("types", model);
    return model;
  }

  private emitPropertyTag(owner: DocletModel, property: ConvertedProperty): void {
    const existing = this.store
      .get<DocTagModel>("tags")
      .filter((tag) => tag.ownerUid === owner.uid && tag.name === "property");
    if (existing.some((tag) => (tag.value ?? "").includes(property.name)))
      return;
    const index = this.store.get<DocTagModel>("tags").length;
    const tag = new DocTagModel({
      uid: DocsIds.tag(owner.uid, "property", index),
      ownerUid: owner.uid,
      name: "property",
      value: `{${property.typeText}} ${property.name}`,
      originalValue: property.name,
      kind: "property",
      comment: property.description,
    });
    this.store.add("tags", tag);
    owner.tagIds = [...owner.tagIds, tag.uid];
  }

  private emitReferences(
    owner: DocletModel,
    tags: readonly ConvertedTag[],
    declaration: ConvertedDeclaration,
    member: ConvertedMember | undefined
  ): DocReferenceModel[] {
    const roles = new Set([
      "see",
      "augments",
      "extends",
      "implements",
      "fires",
      "listens",
      "requires",
    ]);
    const references: DocReferenceModel[] = [];
    const add = (role: string, target: string): void => {
      const cleaned = target
        .replace(/^\{@link\s+/, "")
        .replace(/\}$/, "")
        .trim();
      if (!cleaned) return;
      if (
        references.some(
          (reference) =>
            reference.kind === role &&
            reference.targetLongname === cleaned
        )
      )
        return;
      const reference = new DocReferenceModel({
        uid: DocsIds.reference(owner.uid, cleaned, role, references.length),
        ownerUid: owner.uid,
        index: references.length,
        kind: role,
        targetLongname: cleaned,
      });
      this.store.add("references", reference);
      references.push(reference);
    };
    for (const tag of tags) {
      if (roles.has(tag.title) && tag.value) add(tag.title, tag.value);
    }
    for (const target of member ? [] : declaration.augments)
      add("augments", target);
    for (const target of member ? [] : declaration.implementsList)
      add("implements", target);
    return references;
  }
}

function symbolPath(declaration: ConvertedDeclaration): string {
  return declaration.name;
}

/**
 * @description Resolves the `@memberOf` tag of a top-level declaration into its owner
 * longname.
 * @summary The tag value is kept verbatim (including the JSDoc `module:`
 * prefix) so it matches the longname of the container doclet emitted for the
 * referenced `@module`/`@namespace` declaration.
 * @function memberOfLongname
 * @param {ConvertedTag[]} tags - The converted tags of the declaration.
 * @returns {string | undefined} The verbatim owner longname, or undefined when absent.
 * @memberOf module:docaf
 */
function memberOfLongname(
  tags: readonly ConvertedTag[]
): string | undefined {
  const tag = tags.find(
    (candidate) => candidate.title.toLowerCase() === "memberof"
  );
  const value = tag?.value?.trim();
  return value || undefined;
}
