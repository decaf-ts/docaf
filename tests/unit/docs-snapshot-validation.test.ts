import { InternalError, ValidationError } from "@decaf-ts/db-decorators";
import {
  DocsSnapshotValidationError,
  docsTable,
  validateDocsSnapshot,
} from "../../src/snapshot";
import { cloneFixture } from "./support/fixtures";

function expectInvalid(snapshot: unknown, message: RegExp): void {
  expect(() => validateDocsSnapshot(snapshot)).toThrow(
    DocsSnapshotValidationError
  );
  expect(() => validateDocsSnapshot(snapshot)).toThrow(message);
}

describe("validateDocsSnapshot", () => {
  it("accepts the complete, reference-valid fixture", () => {
    expect(() => validateDocsSnapshot(cloneFixture())).not.toThrow();
  });

  it("exposes the validation error as a Decaf ValidationError", () => {
    try {
      validateDocsSnapshot({ schemaVersion: 2 });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DocsSnapshotValidationError);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as Error).name).toBe("DocsSnapshotValidationError");
    }
  });

  it("rejects an unknown schema version", () => {
    const snapshot = cloneFixture();
    (snapshot as unknown as Record<string, unknown>).schemaVersion = 2;

    expectInvalid(snapshot, /Unsupported docs snapshot schema version: 2/);
  });

  it("rejects missing project and build metadata", () => {
    const missingProject = cloneFixture();
    (missingProject as unknown as Record<string, unknown>).project = {};
    expectInvalid(missingProject, /project\.name/);

    const missingBuild = cloneFixture();
    missingBuild.build.id = "";
    expectInvalid(missingBuild, /build\.id/);
  });

  it("rejects duplicate record keys within a table", () => {
    const snapshot = cloneFixture();
    snapshot.tables.doclets.push({ ...snapshot.tables.doclets[0] });

    expectInvalid(snapshot, /Duplicate key "doclet:docaf-fixture:FixtureClass"/);
  });

  it("rejects unresolved page layout references", () => {
    const snapshot = cloneFixture();
    snapshot.tables.pages[0].layoutId = "layout:missing";

    expectInvalid(snapshot, /Unresolved reference "layout:missing"/);
  });

  it("rejects unresolved doclet signature references", () => {
    const snapshot = cloneFixture();
    snapshot.tables.doclets[1].signatureIds = [
      ...(snapshot.tables.doclets[1].signatureIds ?? []),
      "signature:missing",
    ];

    expectInvalid(snapshot, /Unresolved reference "signature:missing"/);
  });

  it("rejects unresolved component property references", () => {
    const snapshot = cloneFixture();
    snapshot.tables.components[0].propertyUids = [
      ...(snapshot.tables.components[0].propertyUids ?? []),
      "component-property:missing",
    ];

    expectInvalid(snapshot, /Unresolved reference "component-property:missing"/);
  });

  it("rejects unknown tables", () => {
    const snapshot = cloneFixture();
    (snapshot.tables as unknown as Record<string, unknown>).unknown = [];

    expectInvalid(snapshot, /Unknown docs snapshot table "unknown"/);
  });

  it("rejects non-JSON values", () => {
    const snapshot = cloneFixture();
    (snapshot.tables.tags[0] as unknown as Record<string, unknown>).extra =
      () => "value";

    expectInvalid(snapshot, /Unsupported JSON value \(function\)/);
  });

  it("rejects non-finite numbers", () => {
    const snapshot = cloneFixture();
    snapshot.tables.layouts[0].order = Number.POSITIVE_INFINITY;

    expectInvalid(snapshot, /Non-finite number/);
  });

  it("reports unknown table definitions as InternalError", () => {
    expect(() => docsTable("missing" as never)).toThrow(InternalError);
  });
});
