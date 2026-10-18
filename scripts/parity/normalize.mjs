/**
 * Normalization and semantic parsing for the BetterDocs parity harness.
 *
 * Provenance:
 *  - Upstream: SoftwareBrothers/better-docs, commit
 *    248ea8f0ed0eaff9eaf568554566f80454ab8cf5 (2023-12-07, MIT).
 *  - Both the baseline generator and the port comparator feed their synthetic
 *    JSDoc output through `parseComment` so comparisons are semantic (tag
 *    records and identifiers), not raw string or HTML snapshots.
 *
 * Normalization rules (version 1):
 *  1. CRLF/CR are folded to LF.
 *  2. Comment decoration (`/**`, `/*`, leading `*`, trailing `*\/`) is removed.
 *  3. Runs of spaces and tabs collapse to one space; lines are trimmed and
 *     empty lines are dropped. BetterDocs deliberately emits `   ` before
 *     parameter descriptions, so this whitespace is not semantic.
 *  4. Tags become ordered records `{ name, type?, target?, text? }` with alias
 *     folding: `returns` -> `return`, `arg`/`argument` -> `param`.
 *  5. Contiguous non-tag lines attach to the most recent tag (for example an
 *     `@example` body); an anchor line (`Class.prototype.member` or
 *     `Class.member`) is recorded separately and never attached to a tag.
 *  6. Statement output is split into the individual JSDoc blocks BetterDocs
 *     emits per doclet (an interface/class statement emits one block per
 *     documented member).
 *
 * The derived `identifier` and `kind` fields exist for readable failures; the
 * comparator requires deep equality of the complete block record.
 */

export const NORMALIZATION_VERSION = 1;
export const BASELINE_COMMIT =
  "248ea8f0ed0eaff9eaf568554566f80454ab8cf5";
export const BASELINE_REPOSITORY =
  "https://github.com/SoftwareBrothers/better-docs";

const TAG_ALIASES = new Map([
  ["returns", "return"],
  ["return", "return"],
  ["arg", "param"],
  ["argument", "param"],
  ["prop", "property"],
]);

const ANCHOR_PATTERN =
  /^[A-Za-z_$][\w$]*(?:\.prototype)?\.[A-Za-z_$][\w$]*$/;

export function normalizeCommentText(text) {
  return String(text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*\/\*\*?/, "")
        .replace(/\*\/\s*$/, "")
        .replace(/^\s*\*\s?/, "")
        .replace(/[ \t]+/g, " ")
        .trim()
    )
    .filter((line) => line.length > 0)
    .join("\n");
}

export function splitCommentBlocks(text) {
  const source = String(text ?? "");
  const blocks = source.match(/\/\*\*[\s\S]*?\*\//g) ?? [];
  if (blocks.length === 0 && normalizeCommentText(source).length > 0) {
    return [source];
  }
  return blocks;
}

function parseTagLine(line) {
  const match = /^@([A-Za-z][\w-]*)\s*([\s\S]*)$/.exec(line);
  if (!match) return undefined;
  const rawName = match[1];
  const name = TAG_ALIASES.get(rawName) ?? rawName;
  let rest = match[2].trim();
  let type;
  const typed = /^\{([^}]*)\}\s*([\s\S]*)$/.exec(rest);
  if (typed) {
    type = typed[1].replace(/\s+/g, " ").trim();
    rest = typed[2].trim();
  }
  const tag = { name };
  if (type !== undefined) tag.type = type;
  if (name === "param" || name === "property") {
    const [target, ...description] = rest.split(/\s+/);
    if (target) tag.target = target;
    const text = description.join(" ").trim();
    if (text) tag.text = text;
  } else if (rest) {
    tag.text = rest;
  }
  return tag;
}

function deriveKind(block) {
  const names = new Set(block.tags.map((tag) => tag.name));
  if (names.has("interface")) return "interface";
  if (names.has("constructor")) return "constructor";
  if (names.has("method")) return "method";
  const typedef = block.tags.find((tag) => tag.name === "typedef");
  if (typedef) {
    if (typedef.type === "function") return "function";
    if (typedef.type === "object") return "object";
    return "alias";
  }
  if (names.has("type")) return "member";
  if (block.anchors.length) return "member";
  return "comment";
}

function deriveIdentifier(block) {
  const explicit = block.tags.find((tag) => tag.name === "name");
  if (explicit?.text) return explicit.text;
  const named = block.tags.find(
    (tag) => tag.name === "interface" && tag.text
  );
  if (named) return named.text;
  const typedef = block.tags.find(
    (tag) => tag.name === "typedef" && tag.text
  );
  if (typedef) {
    const [, identifier] = /(\S+)\s*$/.exec(typedef.text) ?? [];
    if (identifier) return identifier;
  }
  if (block.anchors.length) return block.anchors[block.anchors.length - 1];
  const firstText = block.text.split("\n")[0];
  if (firstText && /^[A-Za-z_$][\w$]*$/.test(firstText)) return firstText;
  return undefined;
}

export function parseBlock(rawBlock) {
  const lines = normalizeCommentText(rawBlock).split("\n").filter(Boolean);
  const tags = [];
  const anchors = [];
  const text = [];
  let current;

  for (const line of lines) {
    if (ANCHOR_PATTERN.test(line)) {
      anchors.push(line);
      current = undefined;
      continue;
    }
    const tag = parseTagLine(line);
    if (tag) {
      tags.push(tag);
      current = tag;
      continue;
    }
    if (current) {
      current.text = current.text ? `${current.text}\n${line}` : line;
    } else {
      text.push(line);
    }
  }

  const block = {
    text: text.join("\n"),
    tags,
    anchors,
  };
  block.identifier = deriveIdentifier(block);
  block.kind = deriveKind(block);
  return block;
}

export function parseComment(text) {
  return splitCommentBlocks(text).map(parseBlock);
}

export function canonical(value) {
  return JSON.stringify(value, null, 2);
}

/**
 * Human-readable first difference between two canonical records.
 */
export function firstDifference(expected, actual, path = "root") {
  if (expected === actual) return undefined;
  if (
    expected === null ||
    actual === null ||
    typeof expected !== "object" ||
    typeof actual !== "object"
  ) {
    return `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(
      actual
    )}`;
  }
  if (Array.isArray(expected) !== Array.isArray(actual)) {
    return `${path}: expected ${Array.isArray(expected) ? "array" : "object"}, got ${
      Array.isArray(actual) ? "array" : "object"
    }`;
  }
  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) {
      return `${path}: expected ${expected.length} entries, got ${actual.length}`;
    }
    for (let index = 0; index < expected.length; index += 1) {
      const difference = firstDifference(
        expected[index],
        actual[index],
        `${path}[${index}]`
      );
      if (difference) return difference;
    }
    return undefined;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of keys) {
    const difference = firstDifference(
      expected[key],
      actual[key],
      `${path}.${key}`
    );
    if (difference) return difference;
  }
  return undefined;
}
