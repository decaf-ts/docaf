import { ValidationError } from "@decaf-ts/db-decorators";
import { DocletModel } from "../../src/models";
import {
  DocsCodecs,
  DocsTableNames,
  DocsTables,
} from "../../src/snapshot";
import { docsFixture } from "./support/fixtures";

function assertJsonSafe(value: unknown, path = "record"): void {
  if (value === null) return;
  const type = typeof value;
  if (type === "string" || type === "boolean") return;
  if (type === "number") {
    expect(Number.isFinite(value as number)).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
    return;
  }
  expect(type).toBe("object");
  const prototype = Object.getPrototypeOf(value as object);
  expect([Object.prototype, null]).toContain(prototype);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    expect((value as Record<string, unknown>)[key]).not.toBeUndefined();
    assertJsonSafe((value as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

describe("DocsCodecs", () => {
  const snapshot = docsFixture();

  it("registers a codec for every docs table", () => {
    expect(Object.keys(DocsCodecs)).toEqual([...DocsTableNames]);
    for (const table of DocsTables)
      expect(DocsCodecs[table.name]).toBe(table.codec);
  });

  it.each(DocsTables.map((table) => [table.name, table] as const))(
    "%s round-trips encode/decode/encode without drift",
    (name, table) => {
      const record = snapshot.tables[name][0] as never;
      const decoded = table.codec.decode(record);
      const encoded = table.codec.encode(decoded as never);

      expect(encoded).toEqual(record);
      assertJsonSafe(encoded, `tables.${name}[0]`);
      expect(JSON.parse(JSON.stringify(encoded))).toEqual(encoded);

      const decodedAgain = table.codec.decode(encoded as never);
      expect(table.codec.encode(decodedAgain as never)).toEqual(encoded);
    }
  );

  it("includes optional/default arrays when decoding partial records", () => {
    const doclet = new DocletModel({
      uid: "doclet:partial",
      name: "Partial",
      longname: "pkg.Partial",
      kind: "class",
    });
    const encoded = DocsCodecs.doclets.encode(doclet);

    expect(encoded.signatureIds).toEqual([]);
    expect(encoded.typeIds).toEqual([]);
    expect(encoded.exampleIds).toEqual([]);
    expect(encoded.metadata).toBeUndefined();

    const decoded = DocsCodecs.doclets.decode(encoded);
    expect(decoded.signatureIds).toEqual([]);
    expect(decoded.typeIds).toEqual([]);
  });

  it("preserves optional scalar and object values", () => {
    const record = snapshot.tables.layouts[0];
    const encoded = DocsCodecs.layouts.encode(
      DocsCodecs.layouts.decode(record)
    );

    expect(encoded.config).toEqual({ toc: true, width: 320 });
    expect(encoded.slots).toEqual(["main"]);
    expect(encoded.order).toBe(0);
  });

  it("rejects functions and non-plain objects as non-JSON", () => {
    const doclet = new DocletModel({
      uid: "doclet:non-json",
      name: "NonJson",
      longname: "pkg.NonJson",
      kind: "class",
    });
    (doclet as unknown as Record<string, unknown>).metadata = {
      invalid: () => "value",
    };

    expect(() => DocsCodecs.doclets.encode(doclet)).toThrow(ValidationError);

    (doclet as unknown as Record<string, unknown>).metadata = {
      invalid: new Date(),
    };
    expect(() => DocsCodecs.doclets.encode(doclet)).toThrow(ValidationError);
  });

  it("rejects non-finite numbers", () => {
    const doclet = new DocletModel({
      uid: "doclet:nan",
      name: "NaN",
      longname: "pkg.NaN",
      kind: "class",
      order: Number.NaN,
    });

    expect(() => DocsCodecs.doclets.encode(doclet)).toThrow(ValidationError);
  });
});
