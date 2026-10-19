import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../support/harness";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jsYaml = require("js-yaml") as { load(source: string): unknown };

const WORKFLOW_PATH = path.join(
  REPO_ROOT,
  ".github",
  "workflows",
  "docker-publish.yml"
);

const CANONICAL_PUSH_EXPRESSION =
  "${{ github.event_name != 'workflow_dispatch' || inputs.push != false }}";

interface WorkflowTrigger {
  types?: string[];
  inputs?: Record<string, { default?: unknown; type?: string }>;
}

interface WorkflowJob {
  uses?: string;
  secrets?: unknown;
  with?: Record<string, unknown>;
}

interface WorkflowDocument {
  on?: {
    release?: WorkflowTrigger;
    workflow_dispatch?: WorkflowTrigger;
  };
  jobs?: Record<string, WorkflowJob>;
}

function readWorkflow(): {
  source: string;
  document: WorkflowDocument;
} {
  const source = fs.readFileSync(WORKFLOW_PATH, "utf8");
  return { source, document: jsYaml.load(source) as WorkflowDocument };
}

function dockerJob(document: WorkflowDocument): WorkflowJob {
  const job = document.jobs?.docker;
  if (!job) {
    throw new Error("docker-publish.yml no longer defines the docker job");
  }
  return job;
}

function pushExpression(document: WorkflowDocument): string {
  const expression = dockerJob(document).with?.push;
  if (typeof expression !== "string") {
    throw new Error("docker-publish.yml no longer passes a push expression");
  }
  return expression;
}

function normalizeExpression(expression: string): string {
  return expression.replace(/\s+/g, " ").trim();
}

// GitHub performs loose equality by casting mismatched operand types to
// numbers: null -> 0 and false -> 0. This is why the audited
// `inputs.push != false` expression evaluated to false on release events, where
// the `inputs` context has no `push` value (null). JavaScript's own `null` is
// not loosely equal to false, so the conversion is explicit here.
function githubLooseNotEqual(left: unknown, right: unknown): boolean {
  if (
    (left === null || left === undefined) &&
    (right === null || right === undefined)
  ) {
    return false;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return left !== right;
  }
  const toNumber = (value: unknown): number => {
    if (value === null || value === undefined) return 0;
    if (value === true) return 1;
    if (value === false) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") return value === "" ? 0 : Number(value);
    return NaN;
  };
  return toNumber(left) !== toNumber(right);
}

// Mirrors the documented GitHub semantics of the landed expression:
// `github.event_name` is always populated, while `inputs.push` is null outside
// workflow_dispatch. This is a structural guarantee, not an execution of
// GitHub's expression engine.
function releasePushDecision(
  eventName: string,
  pushInput: boolean | null
): boolean {
  return eventName !== "workflow_dispatch" || githubLooseNotEqual(pushInput, false);
}

describe("docker-publish workflow release semantics", () => {
  it("parses and declares the release and manual-dispatch triggers", () => {
    const { document } = readWorkflow();

    expect(document.on?.release?.types).toContain("published");
    expect(document.on?.workflow_dispatch).toBeDefined();
    expect(
      document.on?.workflow_dispatch?.inputs?.push?.default
    ).toBe(true);
  });

  it("pushes on release events regardless of the dispatch input", () => {
    const { document } = readWorkflow();

    expect(normalizeExpression(pushExpression(document))).toBe(
      CANONICAL_PUSH_EXPRESSION
    );
    expect(releasePushDecision("release", null)).toBe(true);
  });

  it("still honours the push input on manual dispatch", () => {
    const { document } = readWorkflow();
    const expression = pushExpression(document);

    expect(expression).toContain("inputs.push != false");
    expect(releasePushDecision("workflow_dispatch", true)).toBe(true);
    expect(releasePushDecision("workflow_dispatch", false)).toBe(false);
  });

  it("excludes the audited expression that skipped release pushes", () => {
    const { document } = readWorkflow();

    expect(normalizeExpression(pushExpression(document))).not.toBe(
      "${{ inputs.push != false }}"
    );
    expect(githubLooseNotEqual(null, false)).toBe(false);
  });

  it("keeps the reusable workflow contract intact", () => {
    const { document } = readWorkflow();
    const job = dockerJob(document);

    expect(job.uses).toBe(
      "decaf-ts/reusable-actions/.github/workflows/docker-publish.yml@master"
    );
    expect(job.secrets).toBe("inherit");
    expect(job.with?.image).toBe("decaf-ts/docaf");
    expect(job.with?.dockerfile).toBe("Dockerfile");
    expect(job.with?.["floating-tag"]).toBe("latest");
  });
});
