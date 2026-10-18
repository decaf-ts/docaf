# BetterDocs port

This package ports the plugin and publisher behavior of
[BetterDocs](https://github.com/SoftwareBrothers/better-docs) into direct Decaf
models. The canonical pipeline does not run BetterDocs, JSDoc, TAFFY, or an HTML
renderer at runtime.

## Upstream pin

- Repository: `https://github.com/SoftwareBrothers/better-docs`
- Commit: `248ea8f0ed0eaff9eaf568554566f80454ab8cf5` (2023-12-07, `master`)
- License: MIT, Copyright 2019 SoftwareBrothers.co (notice reproduced below)

Upstream sources examined for this port:

| Upstream file | Purpose |
| --- | --- |
| `typescript.js` | Plugin entry point and per-file lifecycle |
| `typescript/type-converter.js` | TypeScript AST to JSDoc-shaped doclet data |
| `category.js` | `@category` / `@subcategory` groups |
| `component.js` | `@component` extraction and association |
| `typedef-import.js` | `import("...")` type workaround |
| `load.js`, `lib/load/index.js` | `@load` file content |
| `publish.js` | Pruning, sorting, signatures, modules, links, navigation, pages |

## Decaf mapping

| Upstream operation | Port |
| --- | --- |
| `typescript.js` | `src/generator/betterdocs/typescript/TypeScriptPlugin.ts` |
| `type-converter.js` | `src/generator/betterdocs/typescript/TypeConverter.ts` |
| `category.js` | `src/generator/betterdocs/CategoryPlugin.ts` |
| `component.js` | `src/generator/betterdocs/ComponentPlugin.ts` |
| Angular metadata | `src/generator/extractors/AngularComponentExtractor.ts` |
| `typedef-import.js` | `src/generator/betterdocs/ImportTypePlugin.ts` |
| `load.js` | `src/generator/betterdocs/LoadPlugin.ts` |
| Model emission | `src/generator/writers/DecafModelWriter.ts` |
| Compatibility capture | `src/generator/writers/BetterDocsCompatibilityWriter.ts` |
| Plugin pipeline | `src/generator/pipeline/DocsPipeline.ts` |
| `helper.prune()` | `src/publisher/DocletPruner.ts` |
| Doclet ordering | `src/publisher/DocletSorter.ts` |
| `needsSignature()` / `addSignature*()` / `addAttribs()` | `src/publisher/SignatureBuilder.ts` |
| `attachModuleSymbols()` | `src/publisher/ModuleResolver.ts` |
| `buildNav()` / `buildGroupNav()` / `buildMemberNav()` | `src/publisher/NavigationBuilder.ts` |
| `helper.createLink()` / `registerLink()` | `src/publisher/LinkRegistry.ts` |
| Source normalization | `src/publisher/SourcePublisher.ts` |
| Tutorials | `src/publisher/TutorialBuilder.ts` |
| `generate()` | `src/publisher/PageBuilder.ts` |
| Search data | `src/publisher/SearchIndexBuilder.ts` |
| `publish.js` orchestration | `src/publisher/DecafPublisher.ts` |
| Programmatic entry point | `src/generator/compiler/DocumentationCompiler.ts` |

## Deliberate changes

- **Models instead of HTML.** The publisher emits `DocletModel`,
  `DocPageModel`, `DocSectionModel`, `DocNavigationItemModel`,
  `DocSearchEntryModel`, and related records. No template or HTML is rendered.
- **No TAFFY dependency.** BetterDocs' publisher collection is replaced by a
  typed `PublicationDataset` backed by `RamAdapter` repositories.
- **Single TypeScript program.** The pipeline creates one `ts.Program` and one
  `ts.TypeChecker` per build and shares them across plugins and source files.
- **Native type mode.** `import("pkg").Type` references are resolved through
  TypeScript in native mode. The compatibility mode keeps the historical
  deletion workaround for parity checks.
- **Angular extraction by AST.** Component metadata is read from decorators and
  signal calls through the TypeScript AST, not regular-expression scraping.
- **Hardened `@load`.** Paths resolve against allowed roots, traversal is
  rejected, contents are cached, and missing files are build diagnostics.
- **Deterministic output.** UIDs, route order, navigation order, and snapshot
  ordering are deterministic. The default routing shape is hash routing, while
  stored routes remain renderer-independent.
- **No preview compilation.** Component preview records are not created during
  extraction; preview compilation is a separate concern.
- **Build failure is atomic.** Diagnostics are collected before extraction
  tables are persisted, so a failed build does not leave a partial dataset.

## Fixture

`tests/fixtures/vertical-slice/` is the source-only vertical slice: a class, an
interface hierarchy, category/subcategory tags, `@load` content, and an Angular
`@component` using local decorator stubs (no Angular runtime dependency).
Tests for this fixture are owned by the Tester role and live under
`tests/unit` and `tests/integration`.

## MIT notice

```
Copyright 2019 SoftwareBrothers.co

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
