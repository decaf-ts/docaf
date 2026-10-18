# BetterDocs parity harness

Executable parity check for TDS §18.1: the pinned upstream BetterDocs type
converter and the ported implementation are run against the same common
fixtures, and their normalized doclet semantics are compared.

## Provenance

| Item | Value |
| --- | --- |
| Upstream repository | `https://github.com/SoftwareBrothers/better-docs` |
| Upstream commit | `248ea8f0ed0eaff9eaf568554566f80454ab8cf5` (2023-12-07, `master`) |
| Upstream file under test | `typescript/type-converter.js` |
| License | MIT (see `PORTING.md` for the notice) |
| Port under test | `src/generator/betterdocs/typescript/TypeConverter.ts` |
| Common fixtures | `tests/fixtures/parity/common` (listed in `fixtures.json`) |
| Normalized baseline | `tests/fixtures/parity/baseline.json` |
| Normalization version | `1` (`scripts/parity/normalize.mjs`) |

`baseline.json` is generated from the upstream checkout, then committed. The
comparison itself never downloads BetterDocs, and no BetterDocs, JSDoc, TAFFY
or Playwright package is added to the runtime dependency graph. All harness
code lives under `scripts/parity` and `tests/fixtures/parity`, which are not
part of the published `lib`/`dist` output.

## Commands

```bash
# Executable comparison (uses the committed normalized baseline)
npm run test:parity

# Regenerate the committed baseline from the pinned upstream checkout
git clone https://github.com/SoftwareBrothers/better-docs /tmp/better-docs
git -C /tmp/better-docs checkout 248ea8f0ed0eaff9eaf568554566f80454ab8cf5
npm run parity:baseline
```

Set `BETTER_DOCS_BASELINE_ROOT=/path/to/better-docs` to regenerate from a
checkout elsewhere. `generate-baseline.mjs` refuses to run when the checkout
HEAD does not equal the pin.

`npm run test:parity` verifies the pinned commit and normalization version in
`baseline.json`, checks that each fixture still matches its recorded SHA-256,
then compares every baseline statement's normalized doclet blocks with the
port's `syntheticComment` output. A mismatch prints the first differing record
and exits non-zero. `test:parity` is intentionally separate from `test:all`,
which stays a pure jest run.

## Fixtures

The common fixture set covers the TDS §18.1 cases that the upstream type
converter actually processes:

- classes, constructors, methods, properties, overloads, inheritance,
  visibility (`private`/`protected`), static members and async methods;
- interfaces, type aliases, generic parameters and generic references;
- union, intersection, qualified and `import(...)` type references;
- `@category`, `@subcategory`, custom tags, `@deprecated` and `@example`
  captions;
- `@load` tags (the tag itself is compared here; file loading is covered by
  the pipeline tests);
- an Angular `@component` fixture using local decorator stubs.

Modules/namespaces and documented aliases whose type is an `import(...)` or
qualified reference are emitted by the port but dropped by the upstream type
converter. Those are deliberate improvements, not parity failures; the
comparison still requires the port to emit the declaration and reports the
case as a port-only improvement.

## Normalization rules (version 1)

`normalize.mjs` applies the same transformation to both sides:

1. CRLF/CR folds to LF.
2. JSDoc decoration (`/**`, leading `*`, trailing `*/`) is removed.
3. Whitespace runs collapse to one space; lines are trimmed; empty lines drop.
   BetterDocs deliberately inserts `   ` before parameter descriptions, so
   whitespace is not semantic.
4. Tags become ordered records `{ name, type?, target?, text? }`; `returns`
   folds to `return`, `arg`/`argument` to `param`, `prop` to `property`.
5. Non-tag lines attach to the most recent tag (for example an `@example`
   body). Anchor lines (`Class.prototype.member` or `Class.member`) are kept
   separately and identify class members.
6. A statement's output splits into the individual JSDoc blocks BetterDocs
   emits per doclet.

The normalized record keeps tag order, tag types, parameter/property names,
comment text, examples, anchors and derived identifiers. The comparison is a
deep equality of those records, not a string or HTML snapshot.
