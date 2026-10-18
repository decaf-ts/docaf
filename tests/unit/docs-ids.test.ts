import { DocletModel, DocsIds } from "../../src/models";

describe("DocsIds deterministic identities", () => {
  it("returns the same identity on repeated calls", () => {
    const builders: Array<() => string> = [
      () => DocsIds.doclet("pkg", "Thing"),
      () => DocsIds.member("pkg", "Thing", "run", 0),
      () => DocsIds.tag("owner", "param", 0),
      () => DocsIds.type("owner", "parameter", 0),
      () => DocsIds.parameter("signature", 0),
      () => DocsIds.returns("signature"),
      () => DocsIds.signature("doclet", 0),
      () => DocsIds.example("owner", 0),
      () => DocsIds.source("pkg", "file.ts", 1, 2),
      () => DocsIds.reference("owner", "target", "see", 0),
      () => DocsIds.component("angular", "file.ts", "Export"),
      () => DocsIds.componentProperty("component", "label"),
      () => DocsIds.componentEvent("component", "clicked"),
      () => DocsIds.componentPreview("component"),
      () => DocsIds.tutorial("guide"),
      () => DocsIds.page("home"),
      () => DocsIds.section("page", "intro"),
      () => DocsIds.route("/docs"),
      () => DocsIds.link("source", "target", "member"),
      () => DocsIds.navigation("main"),
      () => DocsIds.navigationItem("navigation", "page"),
      () => DocsIds.search("doclet"),
      () => DocsIds.lookup("kind", "class"),
      () => DocsIds.layout("default"),
      () => DocsIds.manifest("project", "build"),
    ];

    const first = builders.map((build) => build());
    const second = builders.map((build) => build());

    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
    expect(first.every((uid) => uid.length > 0)).toBe(true);
  });

  it("keeps overloads distinguishable while retaining display identity", () => {
    const zero = DocsIds.member("pkg", "Owner", "run", 0);
    const one = DocsIds.member("pkg", "Owner", "run", 1);

    expect(zero).not.toBe(one);
    expect(zero.endsWith(":0")).toBe(true);
    expect(one.endsWith(":1")).toBe(true);

    const first = new DocletModel({
      uid: zero,
      name: "run",
      longname: "pkg.Owner.run",
      kind: "function",
    });
    const second = new DocletModel({
      uid: one,
      name: "run",
      longname: "pkg.Owner.run",
      kind: "function",
    });

    expect(first.uid).not.toBe(second.uid);
    expect(first.name).toBe(second.name);
    expect(first.longname).toBe(second.longname);
  });

  it("normalizes whitespace without collapsing distinct inputs", () => {
    expect(DocsIds.doclet(" pkg ", "Owner  Thing")).toBe(
      DocsIds.doclet("pkg", "Owner Thing")
    );
    expect(DocsIds.doclet("pkg", "OwnerThing")).not.toBe(
      DocsIds.doclet("pkg", "Owner Thing")
    );
  });

  it("namespaces each identity kind", () => {
    expect(DocsIds.doclet("pkg", "Thing")).toMatch(/^doclet:/);
    expect(DocsIds.member("pkg", "Thing", "run")).toMatch(/^doclet:/);
    expect(DocsIds.signature("doclet")).toMatch(/^signature:/);
    expect(DocsIds.parameter("signature", 0)).toMatch(/^parameter:/);
    expect(DocsIds.returns("signature")).toMatch(/^return:/);
    expect(DocsIds.type("owner", "parameter", 0)).toMatch(/^type:/);
    expect(DocsIds.lookup("kind", "class")).toMatch(/^lookup:/);
    expect(DocsIds.manifest("project", "build")).toMatch(/^manifest:/);
  });

  it("treats omitted and zero indices consistently", () => {
    expect(DocsIds.signature("doclet")).toBe(DocsIds.signature("doclet", 0));
    expect(DocsIds.example("owner")).toBe(DocsIds.example("owner", 0));
    expect(DocsIds.tag("owner", "param")).toBe(
      DocsIds.tag("owner", "param", 0)
    );
    expect(DocsIds.type("owner", "parameter")).toBe(
      DocsIds.type("owner", "parameter", 0)
    );
  });
});
