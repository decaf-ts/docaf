import {
  DocReferenceModel,
  DocsIds,
  type DocletModel,
} from "../models";
import { upsert, type PublicationDataset } from "./dataset";
import type { LinkRegistry } from "./LinkRegistry";

/**
 * @description Configuration for the ModuleResolver.
 * @summary `packageName` (required) is used to qualify unqualified `augments` /
 * `implements` targets against the package namespace during longname
 * resolution. `links` is reserved for link-aware resolution steps performed
 * after registration.
 */
export interface ModuleResolutionOptions {
  packageName: string;
  links?: LinkRegistry;
}

/**
 * @description Port of `attachModuleSymbols()` plus inheritance/ancestor resolution from
 * BetterDocs' publisher.
 * @summary Resolves `memberof` longnames to owner uids and completes
 * inheritance/ancestor links over the publication dataset.
 * @class ModuleResolver
 */
export class ModuleResolver {
  constructor(private readonly options: ModuleResolutionOptions) {}

  resolve(dataset: PublicationDataset): void {
    const byLongname = new Map(
      dataset.doclets.map((doclet) => [doclet.longname, doclet])
    );
    const byName = new Map<string, DocletModel[]>();
    for (const doclet of dataset.doclets) {
      const list = byName.get(doclet.name) ?? [];
      list.push(doclet);
      byName.set(doclet.name, list);
    }

    for (const doclet of dataset.doclets) {
      if (doclet.memberof && !doclet.memberofUid) {
        const owner = byLongname.get(doclet.memberof);
        if (owner) doclet.memberofUid = owner.uid;
      }
    }

    for (const doclet of dataset.doclets) {
      if (doclet.kind !== "class" && doclet.kind !== "interface") continue;
      const targets = [...doclet.augments, ...doclet.implements];
      for (const target of targets) {
        const resolved =
          this.resolveLongname(target, byLongname, byName) ??
          this.resolveLongname(
            `${this.options.packageName}.${target}`,
            byLongname,
            byName
          );
        if (!resolved) {
          doclet.metadata = {
            ...(doclet.metadata ?? {}),
            [`unresolved:${target}`]: "true",
          };
          continue;
        }
        const role = doclet.implements.includes(target)
          ? "implements"
          : "augments";
        this.addReference(dataset, doclet, role, resolved);
        if (role === "augments")
          doclet.inherits = [
            ...new Set([...doclet.inherits, resolved.longname]),
          ];
        this.inheritMembers(dataset, doclet, resolved);
      }
    }

    for (const container of dataset.doclets.filter(
      (doclet) => doclet.kind === "module" || doclet.kind === "namespace"
    )) {
      const symbols = dataset.doclets.filter(
        (doclet) =>
          doclet.uid !== container.uid &&
          (doclet.longname === container.longname ||
            doclet.memberof === container.longname ||
            (container.kind === "module" &&
              doclet.name === container.name))
      );
      container.propertyIds = symbols.map((symbol) => symbol.uid);
      for (const symbol of symbols) {
        this.addReference(dataset, container, "module-symbol", symbol);
        if (!symbol.memberof) {
          symbol.memberof = container.longname;
          symbol.memberofUid = container.uid;
        }
      }
    }

    for (const reference of dataset.references) {
      const target =
        byLongname.get(reference.targetLongname) ??
        byName.get(reference.targetLongname.split(".").pop() ?? "")?.[0];
      if (target) reference.targetUid = target.uid;
    }

    for (const doclet of dataset.doclets) {
      doclet.referenceIds = [
        ...new Set([
          ...doclet.referenceIds,
          ...dataset.references
            .filter((reference) => reference.ownerUid === doclet.uid)
            .map((reference) => reference.uid),
        ]),
      ];
    }
  }

  private resolveLongname(
    target: string,
    byLongname: Map<string, DocletModel>,
    byName: Map<string, DocletModel[]>
  ): DocletModel | undefined {
    const direct = byLongname.get(target);
    if (direct) return direct;
    const name = target.split(".").pop();
    if (!name) return undefined;
    const candidates = byName.get(name) ?? [];
    return candidates.length === 1 ? candidates[0] : undefined;
  }

  private inheritMembers(
    dataset: PublicationDataset,
    child: DocletModel,
    parent: DocletModel
  ): void {
    const parentMembers = dataset.doclets.filter(
      (doclet) => doclet.memberofUid === parent.uid
    );
    const childMembers = dataset.doclets.filter(
      (doclet) => doclet.memberofUid === child.uid
    );
    for (const member of childMembers) {
      const overridden = parentMembers.find(
        (candidate) => candidate.name === member.name
      );
      if (!overridden) continue;
      member.overrides = [...new Set([...member.overrides, overridden.longname])];
      this.addReference(dataset, member, "overrides", overridden);
    }
  }

  private addReference(
    dataset: PublicationDataset,
    owner: DocletModel,
    role: string,
    target: DocletModel
  ): DocReferenceModel {
    const uid = DocsIds.reference(owner.uid, target.longname, role, 0);
    const existing =
      dataset.references.find((reference) => reference.uid === uid) ??
      dataset.references.find(
        (reference) =>
          reference.ownerUid === owner.uid &&
          reference.kind === role &&
          (reference.targetUid === target.uid ||
            reference.targetLongname === target.longname ||
            reference.targetLongname.split(".").pop() === target.name)
      );
    if (existing) {
      existing.targetUid = target.uid;
      existing.targetLongname = target.longname;
      return existing;
    }
    const reference = new DocReferenceModel({
      uid,
      ownerUid: owner.uid,
      index: 0,
      kind: role,
      targetLongname: target.longname,
      targetUid: target.uid,
    });
    upsert(dataset.references, reference);
    return reference;
  }

  resolveLinks(dataset: PublicationDataset, links: LinkRegistry): void {
    for (const reference of dataset.references) {
      const target = links.resolve(reference.targetLongname);
      if (!target) continue;
      reference.route = target.route;
      reference.anchor = target.anchor;
    }
  }
}
