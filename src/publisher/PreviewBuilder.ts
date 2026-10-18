import {
  DocComponentModel,
  DocComponentPreviewModel,
  DocExampleModel,
  DocsIds,
  type DocletModel,
} from "../models";
import type { PublicationDataset } from "./dataset";

/**
 * @description Builds executable preview descriptors from documented examples.
 * @summary For every component entry whose doclet carries `@example` tags, a
 * DocComponentPreviewModel is created referencing the component entry, its
 * configurable surface (property and event names) and any input defaults
 * parsed from the example code. Example records remain the source of truth; a
 * preview only references the component entry and its configurable surface,
 * and the resulting collection replaces `dataset.componentPreviews` sorted by
 * uid.
 */
export class PreviewBuilder {
  process(dataset: PublicationDataset): void {
    const doclets = new Map(dataset.doclets.map((doclet) => [doclet.uid, doclet]));
    const examples = new Map(
      dataset.examples.map((example) => [example.uid, example])
    );
    const previews: DocComponentPreviewModel[] = [];

    for (const component of dataset.components) {
      const doclet = doclets.get(component.docletUid);
      if (!doclet || !doclet.exampleIds?.length) continue;
      const properties = dataset.componentProperties
        .filter((property) => property.componentUid === component.uid)
        .map((property) => property.name);
      const events = dataset.componentEvents
        .filter((event) => event.componentUid === component.uid)
        .map((event) => event.name);
      let order = 0;
      for (const exampleUid of doclet.exampleIds) {
        const example = examples.get(exampleUid);
        if (!example) continue;
        previews.push(
          this.preview(component, doclet, example, properties, events, order)
        );
        order += 1;
      }
    }

    dataset.componentPreviews = previews.sort((a, b) =>
      a.uid.localeCompare(b.uid)
    );
  }

  private preview(
    component: DocComponentModel,
    doclet: DocletModel,
    example: DocExampleModel,
    properties: string[],
    events: string[],
    order: number
  ): DocComponentPreviewModel {
    const name = this.nameFor(example, component, order);
    return new DocComponentPreviewModel({
      uid: DocsIds.componentPreview(component.uid, name),
      componentUid: component.uid,
      name,
      kind: "native",
      framework: component.framework,
      entry: component.uid,
      sourceFile: component.sourceFile,
      controls: properties,
      inputDefaults: this.defaultsFrom(example.code, properties),
    });
  }

  private nameFor(
    example: DocExampleModel,
    component: DocComponentModel,
    order: number
  ): string {
    const base =
      example.caption ??
      (order === 0
        ? component.name
        : `${component.name}-${order + 1}`);
    return base.replace(/\s+/g, " ").trim();
  }

  private defaultsFrom(
    code: string,
    properties: readonly string[]
  ): Record<string, string | number | boolean> {
    const defaults: Record<string, string | number | boolean> = {};
    for (const property of properties) {
      const value = this.defaultValue(code, property);
      if (value === undefined) continue;
      defaults[property] = this.literal(value);
    }
    return defaults;
  }

  private defaultValue(code: string, property: string): string | undefined {
    const isIdentifierCharacter = (character: string): boolean =>
      /[A-Za-z0-9_$]/.test(character);
    for (const name of [property, `"${property}"`, `'${property}'`]) {
      let index = code.indexOf(name);
      while (index >= 0) {
        const quoted = name !== property;
        const boundaryBefore =
          quoted || index === 0 || !isIdentifierCharacter(code[index - 1]);
        let cursor = index + name.length;
        while (/\s/.test(code[cursor] ?? "")) cursor += 1;
        if (boundaryBefore && code[cursor] === ":") {
          cursor += 1;
          while (/\s/.test(code[cursor] ?? "")) cursor += 1;
          const value = this.literalAt(code, cursor);
          if (value !== undefined) return value;
        }
        index = code.indexOf(name, index + 1);
      }
    }
    return undefined;
  }

  private literalAt(code: string, index: number): string | undefined {
    const quote = code[index];
    if (quote === '"' || quote === "'") {
      const end = code.indexOf(quote, index + 1);
      return end > index ? code.slice(index, end + 1) : undefined;
    }
    const match = /^(?:true|false|-?\d+(?:\.\d+)?)/.exec(code.slice(index));
    return match ? match[0] : undefined;
  }

  private literal(value: string): string | number | boolean {
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    return value.slice(1, -1);
  }
}
