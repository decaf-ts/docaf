import fs from "node:fs";
import path from "node:path";
import { AngularDocsBuildTarget } from "../../src/build/AngularDocsBuildTarget";
import type { DocsBuildContext } from "../../src/build/DocsBuildTarget";
import {
  REPO_ROOT,
  cleanupTempDirs,
  makeTempDir,
  writeFile,
} from "../support/harness";
import { cloneFixture } from "./support/fixtures";

function codesOf(error: unknown): string[] {
  return (
    (error as { diagnostics?: { code: string }[] }).diagnostics ?? []
  ).map((entry) => entry.code);
}

interface Project {
  root: string;
  snapshotPath: string;
  context: DocsBuildContext;
}

function project(
  prefix: string,
  snapshot: unknown = cloneFixture()
): Project {
  const root = makeTempDir(prefix);
  writeFile(root, "package.json", JSON.stringify({ name: "docs-fixture" }));
  const snapshotPath = path.join(root, "snapshot.json");
  fs.writeFileSync(
    snapshotPath,
    typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot)
  );
  return {
    root,
    snapshotPath,
    context: {
      projectRoot: root,
      outputDirectory: path.join(root, "out"),
      snapshotPath,
      config: {
        project: { name: "docs-fixture", version: "1.0.0" },
        output: { baseHref: "/" },
      },
      components: [],
      previews: [],
      layouts: [],
    },
  };
}

function targetFor(projectRoot: string, packageRoot = REPO_ROOT) {
  return new AngularDocsBuildTarget({
    packageRoot,
    configuration: "development",
  });
}

async function invalidSnapshot(
  snapshot: unknown
): Promise<{ codes: string[]; message: string }> {
  const fixture = project("docaf-target-invalid-", snapshot);
  const target = targetFor(fixture.root);
  try {
    await target.validate(fixture.context);
    throw new Error("expected validation to fail");
  } catch (error) {
    return {
      codes: codesOf(error),
      message: (error as Error).message,
    };
  }
}

afterAll(() => cleanupTempDirs());

describe("AngularDocsBuildTarget snapshot validation (M1)", () => {
  it("accepts a valid schemaVersion 1 snapshot", async () => {
    const fixture = project("docaf-target-valid-");
    const target = targetFor(fixture.root);

    await expect(target.validate(fixture.context)).resolves.toBeUndefined();
  });

  it("rejects schemaVersion 2 with a clean DocsBuildError", async () => {
    const snapshot = cloneFixture();
    (snapshot as unknown as { schemaVersion: number }).schemaVersion = 2;

    const failure = await invalidSnapshot(snapshot);

    expect(failure.codes).toEqual(["DOCS_SNAPSHOT_INVALID"]);
    expect(failure.message).toContain("failed validation");
    expect(failure.message).toContain(
      "Unsupported docs snapshot schema version: 2"
    );
    expect(failure.message).not.toContain("TypeError");
  });

  it("rejects a dangling schemaVersion 1 cross-reference with the reason", async () => {
    const snapshot = cloneFixture();
    snapshot.tables.doclets[0].tagIds = ["tag:missing"];

    const failure = await invalidSnapshot(snapshot);

    expect(failure.codes).toEqual(["DOCS_SNAPSHOT_INVALID"]);
    expect(failure.message).toContain("failed validation");
    expect(failure.message).toContain(
      'Unresolved reference "tag:missing" at tables.doclets[0].tagIds'
    );
  });

  it("rejects a snapshot that is not valid JSON", async () => {
    const fixture = project("docaf-target-bad-json-", "{ not json");
    const target = targetFor(fixture.root);

    try {
      await target.validate(fixture.context);
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(codesOf(error)).toEqual(["DOCS_SNAPSHOT_INVALID"]);
      expect((error as Error).message).toContain("is not valid JSON");
    }
  });

  it("reports a missing snapshot file", async () => {
    const fixture = project("docaf-target-missing-");
    fs.rmSync(fixture.snapshotPath);
    const target = targetFor(fixture.root);

    try {
      await target.validate(fixture.context);
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(codesOf(error)).toEqual(["DOCS_SNAPSHOT_MISSING"]);
      expect((error as Error).message).toContain(fixture.snapshotPath);
    }
  });

  it("rejects a cross-framework preview", async () => {
    const snapshot = cloneFixture();
    snapshot.tables.componentPreviews[0].framework = "react";

    const failure = await invalidSnapshot(snapshot);

    expect(failure.codes).toEqual(["DOCS_CROSS_FRAMEWORK_PREVIEW"]);
    expect(failure.message).toContain("react");
  });

  it("accepts previews with an unknown framework", async () => {
    const snapshot = cloneFixture();
    snapshot.tables.componentPreviews[0].framework = "unknown";

    const fixture = project("docaf-target-unknown-framework-", snapshot);
    const target = targetFor(fixture.root);

    await expect(target.validate(fixture.context)).resolves.toBeUndefined();
  });

  it("reports dependencies that cannot be resolved", async () => {
    const fixture = project("docaf-target-missing-deps-");
    const packageRoot = makeTempDir("docaf-target-empty-package-");
    writeFile(packageRoot, "package.json", JSON.stringify({ name: "empty" }));
    const target = targetFor(fixture.root, packageRoot);

    try {
      await target.validate(fixture.context);
      throw new Error("expected validation to fail");
    } catch (error) {
      const codes = codesOf(error);
      expect(codes.length).toBeGreaterThan(0);
      expect(codes.every((code) => code === "DOCS_ANGULAR_DEPENDENCY")).toBe(
        true
      );
      expect((error as Error).message).toContain("@angular/core");
    }
  });
});

describe("AngularDocsBuildTarget prepare", () => {
  it("scaffolds the Angular app, preview registry and assets", async () => {
    const maliciousExport = 'Fixture"; globalThis.pwned = true; "';
    const snapshot = cloneFixture();
    snapshot.tables.components[0].sourceFile = "src/fixture.ts";
    snapshot.tables.components[0].exportName = maliciousExport;
    const fixture = project("docaf-target-prepare-", snapshot);
    writeFile(
      fixture.root,
      "src/fixture.ts",
      'import { Component } from "@angular/core";\n\nexport class FixtureComponent {}\n'
    );
    const target = targetFor(fixture.root);

    await target.prepare(fixture.context);

    const appDir = path.join(
      fixture.context.outputDirectory,
      ".docaf-angular-app"
    );
    const registry = fs.readFileSync(
      path.join(appDir, "src", "app", "preview-registry.ts"),
      "utf8"
    );

    expect(fs.existsSync(path.join(appDir, "angular.json"))).toBe(true);
    expect(fs.existsSync(path.join(appDir, "tsconfig.app.json"))).toBe(true);
    expect(fs.existsSync(path.join(appDir, "src", "main.ts"))).toBe(true);
    expect(
      fs.existsSync(path.join(appDir, "public", "assets", "docs", "snapshot.json"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(appDir, "public", "assets", "i18n", "en.json"))
    ).toBe(true);
    expect(registry).toContain(`module[${JSON.stringify(maliciousExport)}]`);
    expect(registry).toContain(JSON.stringify(snapshot.tables.components[0].uid));
    expect(registry).not.toContain(`module[${maliciousExport}]`);
  });

  it("generates a synthetic preview when the component source cannot be imported", async () => {
    const snapshot = cloneFixture();
    snapshot.tables.components[0].sourceFile = "src/does-not-exist.ts";
    const fixture = project("docaf-target-synthetic-", snapshot);
    const target = targetFor(fixture.root);

    await target.prepare(fixture.context);

    const appDir = path.join(
      fixture.context.outputDirectory,
      ".docaf-angular-app"
    );
    const previews = fs.readdirSync(path.join(appDir, "src", "app", "previews"));
    const registry = fs.readFileSync(
      path.join(appDir, "src", "app", "preview-registry.ts"),
      "utf8"
    );

    expect(previews).toEqual(["fixturecomponent.preview.ts"]);
    expect(registry).toContain("FixtureComponentSyntheticPreview");
    expect(registry).toContain("() => Promise.resolve(FixtureComponentSyntheticPreview)");
  });

  it("escapes project metadata written into index.html", async () => {
    const snapshot = cloneFixture();
    snapshot.project.name = 'Docs <script>"x"</script> & Co';
    const fixture = project("docaf-target-escape-", snapshot);
    fixture.context.config.project = {
      name: 'Docs <script>"x"</script> & Co',
    };
    fixture.context.config.output = { baseHref: '/docs/"quoted"/' };
    const target = targetFor(fixture.root);

    await target.prepare(fixture.context);

    const indexHtml = fs.readFileSync(
      path.join(
        fixture.context.outputDirectory,
        ".docaf-angular-app",
        "src",
        "index.html"
      ),
      "utf8"
    );
    expect(indexHtml).toContain(
      "Docs &lt;script&gt;&quot;x&quot;&lt;/script&gt; &amp; Co"
    );
    expect(indexHtml).not.toContain("<script>\"x\"</script>");
    expect(indexHtml).toContain('href="/docs/&quot;quoted&quot;/"');
  });
});

describe("AngularDocsBuildTarget path containment (L2)", () => {
  it("accepts a source file inside the project root", async () => {
    const fixture = project("docaf-target-inside-");
    writeFile(fixture.root, "src/inside.ts", "export const inside = 1;\n");
    const target = targetFor(fixture.root);

    const resolved = await (
      target as unknown as {
        componentSource(
          context: DocsBuildContext,
          sourceFile: string | undefined
        ): Promise<string | undefined>;
      }
    ).componentSource(fixture.context, "src/inside.ts");

    expect(resolved).toBe(path.join(fixture.root, "src", "inside.ts"));
  });

  it("refuses relative traversal outside the project root", async () => {
    const outside = makeTempDir("docaf-target-outside-");
    writeFile(outside, "secret.ts", "export const secret = 1;\n");
    const fixture = project("docaf-target-traversal-");
    const target = targetFor(fixture.root);

    const resolved = await (
      target as unknown as {
        componentSource(
          context: DocsBuildContext,
          sourceFile: string | undefined
        ): Promise<string | undefined>;
      }
    ).componentSource(
      fixture.context,
      path.relative(fixture.root, path.join(outside, "secret.ts"))
    );

    expect(resolved).toBeUndefined();
  });

  it("refuses an absolute path outside the project and package roots", async () => {
    const outside = makeTempDir("docaf-target-absolute-");
    const absolute = writeFile(
      outside,
      "secret.ts",
      "export const secret = 1;\n"
    );
    const fixture = project("docaf-target-absolute-project-");
    const target = targetFor(fixture.root);

    const resolved = await (
      target as unknown as {
        componentSource(
          context: DocsBuildContext,
          sourceFile: string | undefined
        ): Promise<string | undefined>;
      }
    ).componentSource(fixture.context, absolute);

    expect(resolved).toBeUndefined();
  });

  it("returns undefined when no source file is given", async () => {
    const fixture = project("docaf-target-nosource-");
    const target = targetFor(fixture.root);

    const resolved = await (
      target as unknown as {
        componentSource(
          context: DocsBuildContext,
          sourceFile: string | undefined
        ): Promise<string | undefined>;
      }
    ).componentSource(fixture.context, undefined);

    expect(resolved).toBeUndefined();
  });

  it("finds a source file by suffix inside the project root", async () => {
    const fixture = project("docaf-target-search-");
    const source = writeFile(
      fixture.root,
      "packages/pkg/src/deep/widget.ts",
      "export const widget = 1;\n"
    );
    const target = targetFor(fixture.root);

    const resolved = await (
      target as unknown as {
        componentSource(
          context: DocsBuildContext,
          sourceFile: string | undefined
        ): Promise<string | undefined>;
      }
    ).componentSource(fixture.context, "src/deep/widget.ts");

    expect(resolved).toBe(source);
  });
});

describe("AngularDocsBuildTarget helpers", () => {
  it("copies the built dist and removes stale output", async () => {
    const fixture = project("docaf-target-copy-");
    const dist = path.join(
      fixture.context.outputDirectory,
      ".docaf-angular-app",
      "dist",
      "browser"
    );
    writeFile(dist, "index.html", "<html></html>");
    writeFile(dist, "assets/app.js", "console.log('app');");
    writeFile(fixture.context.outputDirectory, "stale.txt", "old");
    const target = targetFor(fixture.root);

    const files = await (
      target as unknown as {
        copyDist(distDir: string, outputDirectory: string): Promise<string[]>;
      }
    ).copyDist(dist, fixture.context.outputDirectory);

    expect(files).toEqual(["assets/app.js", "index.html"]);
    expect(
      fs.existsSync(path.join(fixture.context.outputDirectory, "stale.txt"))
    ).toBe(false);
    expect(
      fs.existsSync(path.join(fixture.context.outputDirectory, "index.html"))
    ).toBe(true);
  });

  it("reports a missing Angular dist output", async () => {
    const fixture = project("docaf-target-copy-missing-");
    const target = targetFor(fixture.root);

    try {
      await (
        target as unknown as {
          copyDist(distDir: string, outputDirectory: string): Promise<string[]>;
        }
      ).copyDist(
        path.join(fixture.root, "missing"),
        fixture.context.outputDirectory
      );
      throw new Error("expected copyDist to fail");
    } catch (error) {
      expect(codesOf(error)).toEqual(["DOCS_ANGULAR_OUTPUT_MISSING"]);
    }
  });

  it("collects warnings from a successful child process", async () => {
    const fixture = project("docaf-target-run-");
    const script = writeFile(
      fixture.root,
      "ok.js",
      'console.log("warning: generated a large chunk");\n'
    );
    const warnings: string[] = [];
    const target = targetFor(fixture.root);

    await (
      target as unknown as {
        run(
          executable: string,
          args: string[],
          cwd: string,
          warnings: string[]
        ): Promise<void>;
      }
    ).run(script, [], fixture.root, warnings);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("warning: generated a large chunk");
  });

  it("rejects a child process that exits non-zero", async () => {
    const fixture = project("docaf-target-run-fail-");
    const script = writeFile(
      fixture.root,
      "fail.js",
      'console.error("boom");\nprocess.exit(3);\n'
    );
    const target = targetFor(fixture.root);

    try {
      await (
        target as unknown as {
          run(
            executable: string,
            args: string[],
            cwd: string,
            warnings: string[]
          ): Promise<void>;
        }
      ).run(script, [], fixture.root, []);
      throw new Error("expected run to fail");
    } catch (error) {
      expect(codesOf(error)).toEqual(["DOCS_ANGULAR_BUILD_FAILED"]);
      expect((error as Error).message).toContain("exit code 3");
      expect((error as Error).message).toContain("boom");
    }
  });

  it("accepts child processes without warning output", async () => {
    const fixture = project("docaf-target-run-quiet-");
    const script = writeFile(fixture.root, "quiet.js", "");
    const warnings: string[] = [];
    const target = targetFor(fixture.root);

    await (
      target as unknown as {
        run(
          executable: string,
          args: string[],
          cwd: string,
          warnings: string[]
        ): Promise<void>;
      }
    ).run(script, [], fixture.root, warnings);

    expect(warnings).toEqual([]);
  });

  it("links the package node_modules into the generated app", async () => {
    const fixture = project("docaf-target-link-");
    const appDir = path.join(fixture.context.outputDirectory, "app");
    fs.mkdirSync(appDir, { recursive: true });
    writeFile(appDir, "package.json", JSON.stringify({ name: "app" }));
    const target = targetFor(fixture.root);

    await (
      target as unknown as {
        ensureDependencies(appDir: string): Promise<void>;
      }
    ).ensureDependencies(appDir);

    expect(fs.existsSync(path.join(appDir, "node_modules"))).toBe(true);
  });

  it("leaves an existing app node_modules untouched", async () => {
    const fixture = project("docaf-target-existing-modules-");
    const appDir = path.join(fixture.context.outputDirectory, "app");
    writeFile(appDir, "node_modules/marker.txt", "keep");
    const target = targetFor(fixture.root);

    await (
      target as unknown as {
        ensureDependencies(appDir: string): Promise<void>;
      }
    ).ensureDependencies(appDir);

    expect(
      fs.readFileSync(path.join(appDir, "node_modules", "marker.txt"), "utf8")
    ).toBe("keep");
  });

  it("resolves the Angular CLI binary", () => {
    const fixture = project("docaf-target-ng-");
    const target = targetFor(fixture.root);

    const binary = (
      target as unknown as { resolveNgBinary(): string }
    ).resolveNgBinary();

    expect(path.basename(binary)).toBe("ng.js");
    expect(fs.existsSync(binary)).toBe(true);
  });

  it("ships the docs stylesheet", () => {
    const fixture = project("docaf-target-styles-");
    const stylesheet = (
      targetFor(fixture.root) as unknown as { stylesheet(): string }
    ).stylesheet();

    expect(stylesheet).toContain("@import \"@ionic/angular/css/core.css\"");
    expect(stylesheet).toContain(".docs-synthetic-preview");
  });
});
