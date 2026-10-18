import { createRequire } from "node:module";
import type {
  ResolvedDocsConfig,
  ResolvedDocsTarget,
} from "../../src/cli/types";

const requireCjs = createRequire(__filename);
const {
  parseRendererSelection,
  selectTargets,
  supportedRenderers,
} = requireCjs("../../lib/cjs/cli/targets.cjs") as typeof import("../../src/cli/targets");

function target(
  renderer: string,
  output: string
): ResolvedDocsTarget {
  return {
    renderer,
    output,
    routing: "hash",
    baseHref: "/",
    configuration: "production",
  };
}

function configWith(targets: ResolvedDocsTarget[]): ResolvedDocsConfig {
  return {
    root: "/tmp/docs-project",
    packageRoot: "/tmp/docs-project",
    project: { name: "targets-fixture", version: "0.0.0" },
    source: {
      tsconfigPath: "/tmp/docs-project/tsconfig.json",
      include: ["src/**/*.ts"],
      exclude: [],
    },
    publisher: { includePrivate: false },
    storage: {
      snapshotDirectory: "/tmp/docs-project/.decaf-docs",
      snapshotPath: "/tmp/docs-project/.decaf-docs/snapshot.json",
      manifestPath: "/tmp/docs-project/.decaf-docs/build-cache.json",
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
  it("lists the renderers implemented in this release", () => {
    expect(supportedRenderers()).toEqual(["angular"]);
  });
});

describe("selectTargets", () => {
  const angular = target("angular", "/tmp/docs-project/dist/docs");
  const secondAngular = target("angular", "/tmp/docs-project/dist/docs-alt");

  it("returns every configured target when nothing is requested", () => {
    const config = configWith([angular, secondAngular]);

    expect(selectTargets(config)).toBe(config.targets);
    expect(selectTargets(config, [])).toBe(config.targets);
  });

  it("filters to the requested renderer and fails when none is configured", () => {
    const config = configWith([angular]);

    expect(selectTargets(config, ["angular"])).toEqual([angular]);

    expect(codesOf(() => selectTargets(configWith([]), ["angular"]))).toContain(
      "DOCAF_TARGET_NOT_CONFIGURED"
    );
  });

  it("returns each configured target once for repeated requests", () => {
    const config = configWith([angular, secondAngular]);

    expect(selectTargets(config, ["angular", "angular"])).toEqual([
      angular,
      secondAngular,
    ]);
  });

  it("rejects unsupported renderers and names supported and configured renderers", () => {
    const config = configWith([angular]);

    let error: { diagnostics?: { code: string; message: string }[] } | undefined;
    try {
      selectTargets(config, ["svelte"]);
    } catch (caught) {
      error = caught as typeof error;
    }

    expect(error?.diagnostics?.map((entry) => entry.code)).toContain(
      "DOCAF_RENDERER_UNSUPPORTED"
    );
    const message = error?.diagnostics?.[0]?.message ?? "";
    expect(message).toContain("Supported renderers: angular");
    expect(message).toContain("Configured renderers: angular");
  });
});

describe("parseRendererSelection", () => {
  it("returns undefined when neither flag is present", () => {
    expect(parseRendererSelection({})).toBeUndefined();
    expect(parseRendererSelection({ targets: "   " })).toBeUndefined();
  });

  it("accepts --renderer", () => {
    expect(parseRendererSelection({ renderer: "angular" })).toEqual([
      "angular",
    ]);
  });

  it("splits --targets on commas and whitespace", () => {
    expect(parseRendererSelection({ targets: "angular" })).toEqual(["angular"]);
    expect(parseRendererSelection({ targets: "angular, svelte" })).toEqual([
      "angular",
      "svelte",
    ]);
    expect(parseRendererSelection({ targets: "angular svelte" })).toEqual([
      "angular",
      "svelte",
    ]);
  });

  it("rejects using --renderer and --targets together", () => {
    expect(
      codesOf(() =>
        parseRendererSelection({ renderer: "angular", targets: "angular" })
      )
    ).toContain("DOCAF_CLI_SELECTION_CONFLICT");
  });
});
