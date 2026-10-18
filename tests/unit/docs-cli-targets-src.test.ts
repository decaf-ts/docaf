import { AngularDocsBuildTarget } from "../../src/build/AngularDocsBuildTarget";
import {
  createBuildTarget,
  parseRendererSelection,
  selectTargets,
  supportedRenderers,
} from "../../src/cli/targets";
import type {
  ResolvedDocsConfig,
  ResolvedDocsTarget,
} from "../../src/cli/types";

function target(renderer: string, output: string): ResolvedDocsTarget {
  return {
    renderer,
    output,
    routing: "hash",
    baseHref: "/",
    configuration: "production",
  };
}

function configWith(
  targets: ResolvedDocsTarget[],
  root = "/tmp/docs-project"
): ResolvedDocsConfig {
  return {
    root,
    packageRoot: root,
    project: { name: "targets-src-fixture", version: "0.0.0" },
    source: {
      tsconfigPath: `${root}/tsconfig.json`,
      include: ["src/**/*.ts"],
      exclude: [],
    },
    publisher: { includePrivate: false },
    storage: {
      snapshotDirectory: `${root}/.decaf-docs`,
      snapshotPath: `${root}/.decaf-docs/snapshot.json`,
      manifestPath: `${root}/.decaf-docs/build-cache.json`,
    },
    targets,
    warnings: [],
    config: {},
  };
}

function codesOf(action: () => unknown): string[] {
  try {
    action();
    throw new Error("expected a DocsBuildError");
  } catch (error) {
    return ((error as { diagnostics?: { code: string }[] }).diagnostics ?? []).map(
      (entry) => entry.code
    );
  }
}

describe("supportedRenderers", () => {
  it("reports every registered renderer in sorted order", () => {
    expect(supportedRenderers()).toEqual(["angular"]);
  });
});

describe("createBuildTarget", () => {
  it("instantiates the Angular build target for an angular target", () => {
    const buildTarget = createBuildTarget(target("angular", "/tmp/docs-out"), {
      packageRoot: "/tmp/docaf-package",
      configuration: "development",
    });

    expect(buildTarget).toBeInstanceOf(AngularDocsBuildTarget);
    expect(buildTarget.id).toBe("angular");
    expect(buildTarget.rendererFlavour).toBe("angular");
  });

  it("rejects a renderer without a registered factory", () => {
    expect(
      codesOf(() =>
        createBuildTarget(target("svelte", "/tmp/docs-out"), {
          packageRoot: "/tmp/docaf-package",
          configuration: "production",
        })
      )
    ).toEqual(["DOCAF_RENDERER_UNSUPPORTED"]);
  });
});

describe("selectTargets", () => {
  it("returns every configured target when no renderers are requested", () => {
    const angular = target("angular", "/tmp/angular-out");
    const config = configWith([angular]);

    expect(selectTargets(config)).toBe(config.targets);
    expect(selectTargets(config, [])).toBe(config.targets);
  });

  it("filters requested renderers and de-duplicates by renderer/output", () => {
    const first = target("angular", "/tmp/angular-out");
    const duplicate = target("angular", "/tmp/angular-out");
    const other = target("angular", "/tmp/other-out");
    const config = configWith([first, duplicate, other]);

    expect(selectTargets(config, ["angular"])).toEqual([first, other]);
  });

  it("rejects an unsupported requested renderer", () => {
    expect(
      codesOf(() =>
        selectTargets(configWith([target("angular", "/tmp/out")]), ["svelte"])
      )
    ).toEqual(["DOCAF_RENDERER_UNSUPPORTED"]);
  });

  it("rejects a supported renderer with no configured target", () => {
    expect(
      codesOf(() =>
        selectTargets(configWith([target("svelte", "/tmp/out")]), ["angular"])
      )
    ).toEqual(["DOCAF_TARGET_NOT_CONFIGURED"]);
  });
});

describe("parseRendererSelection", () => {
  it("returns undefined when no selection options are given", () => {
    expect(parseRendererSelection({})).toBeUndefined();
  });

  it("accepts a single --renderer value", () => {
    expect(parseRendererSelection({ renderer: "angular" })).toEqual([
      "angular",
    ]);
  });

  it("splits --targets on commas and whitespace", () => {
    expect(
      parseRendererSelection({ targets: " angular,  svelte ,,react " })
    ).toEqual(["angular", "svelte", "react"]);
  });

  it("returns undefined for an empty --targets value", () => {
    expect(parseRendererSelection({ targets: " , " })).toBeUndefined();
  });

  it("rejects combining --renderer with --targets", () => {
    expect(
      codesOf(() =>
        parseRendererSelection({ renderer: "angular", targets: "angular" })
      )
    ).toEqual(["DOCAF_CLI_SELECTION_CONFLICT"]);
  });
});
