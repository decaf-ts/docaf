## Documentation Guide

`@decaf-ts/docaf` builds the API site from JSDoc comments in `src/`. The generator is a
BetterDocs port, but it is self-contained: docaf does not install or run better-docs, JSDoc,
TaffyDB, or the BetterDocs template. Only the tags and comment shapes described here are read.

The long-form guides under `workdocs/` are separate Markdown files. `README.md` is composed from
`workdocs/` by `npm run readme`, and the API site is produced by `npm run docs`.

### How docaf reads a comment

```ts
/**
 * Fetch a user by identifier.
 *
 * The lookup is cached for the lifetime of the service instance.
 *
 * @param id - Unique user identifier.
 * @returns The matching user.
 * @throws When the identifier is empty.
 * @example
 * <caption>Basic lookup</caption>
 * const user = await service.getUser("u-1");
 * @see User
 */
async getUser(id: string): Promise<User> {
  // ...
}
```

The free-form comment before the first tag becomes the declaration description. The first line is
also used as the short summary. Tags are stored and rendered separately.

**Write prose, not `@description`/`@summary` tags.** docaf preserves `@description` and `@summary`
as ordinary tags, but it does not use them to fill the description panel. A comment that contains
only those tags produces an empty description.

### Supported tags

| Tag | Effect |
| --- | --- |
| Free-form comment | Description and summary |
| `@param {T} name - text` | Parameter documentation; type is optional because it is read from TypeScript |
| `@returns {T} text` / `@return {T} text` | Return documentation; synthesized from the signature when omitted |
| `@throws text` | Documented exception; stored and rendered as a tag |
| `@example` | Code example; an optional `<caption>Title</caption>` on the first line becomes the caption |
| `@category name` | Top-level navigation category |
| `@subcategory name` | Grouping inside a category |
| `@component` | Marks an Angular component for extraction; requires a supported Angular decorator |
| `@deprecated` | Marks the declaration deprecated |
| `@since version` | Records the introduction version |
| `@version version` | Records a version value |
| `@tutorial name` | Links the doclet to a named tutorial record |
| `@see target` | Cross-reference, resolved into the docs link registry |
| `@augments target`, `@extends target` | Inheritance reference |
| `@implements target` | Interface implementation reference |
| `@fires event`, `@listens event`, `@requires target` | Additional reference roles |
| `@load path` | Appends a Markdown file to the description; the path must stay under the documented source root |

Declarations are typed from TypeScript syntax, so `@class`, `@interface`, `@function`, `@typedef`,
and `@const` are not required. docaf derives the kind from the AST; adding those tags only stores
redundant tag records.

### What is not supported

- `@menu` and `@category`-style site metadata beyond `@category`/`@subcategory`. The sidebar is
  built from the doclet kind, inheritance, and those two tags.
- `@mermaid` and diagram rendering. Put diagrams in Markdown guides instead of API comments.
- `@private`, `@protected`, `@abstract`, and `@readonly` as behavioral switches. Use TypeScript
  modifiers; docaf reads access, `abstract`, `readonly`, `static`, and `async` from the AST.
- `@ignore` and `@internal` metadata. Privacy is controlled by the TypeScript modifier and the
  publisher's `includePrivate` setting.
- JSDoc `@link` navigation inside prose. The text is preserved, but use `@see` for a reference
  that the link registry can resolve.

### Comments by declaration

**Classes and interfaces.** Describe the type in prose, then tag methods and properties. Docaf
turns interface and type-literal members into documented properties automatically.

```ts
/**
 * Coordinates extraction and publication.
 *
 * A single TypeScript program is shared for the whole build.
 */
export class DocsPipeline {
  /**
   * Run every configured plugin over the selected sources.
   *
   * @param files - Absolute paths to the source files.
   * @returns The published dataset and diagnostics.
   */
  async build(files: readonly string[]): Promise<DocsPipelineResult> {
    // ...
  }
}
```

**Functions and methods.** Document behavior, then parameters and return value. `@param` names
must match the TypeScript parameter names; optional parameters may be written as `[name]`.
`@returns` and `@return` are equivalent.

**Type aliases, enums, and constants.** A prose description is enough. Object and union members
are expanded into properties when the type shape can be read. Constants are published as member
pages.

**Angular components.** Add `@component` to a class decorated with `@Component(...)` and configure
the Angular extractor (the default). The extractor reads the selector, inputs, outputs, and
template metadata. Document inputs and outputs in prose; their types come from the decorators and
TypeScript declarations.

```ts
/**
 * Renders a documentation example.
 *
 * @component
 */
@Component({ selector: "docs-example", template: "..." })
export class DocsExampleComponent {}
```

### Examples

An `@example` tag becomes a code block. Use a caption when the example needs a title:

```ts
/**
 * Normalize a snapshot.
 *
 * @example
 * <caption>Stable output</caption>
 * const canonical = canonicalize(snapshot);
 */
```

Without a caption, the whole tag body is the code. Multiple `@example` tags are kept in order.

### Categories and navigation

`@category` creates a top-level group; `@subcategory` creates a nested group. Names are sorted
alphabetically, and declaration order within a group is preserved. Use categories for product
areas, not for every file. `publisher.preserveCategories` and
`publisher.preserveSubcategories` are accepted in configuration for compatibility, but the
current release always preserves both on published doclets.

### Writing style

- Start with one sentence that stands alone in search results.
- Explain preconditions, side effects, and failure modes; do not restate the signature.
- Prefer concrete nouns and active voice.
- Use fenced code blocks with a language tag in Markdown guides.
- Keep lines readable; the generator preserves paragraph breaks.
- Link to guides with relative paths, and verify they resolve from the file's location.
- Do not document generated folders (`lib/`, `dist/`, `docs/`) or template scaffolding.

### Verifying documentation

```bash
npm run lint          # catches malformed comments through the TypeScript parser
npm run docs          # regenerate README and the API site
npm run test:parity   # required when changing the type converter or JSDoc handling
```

Open `docs/` through a local static server if you need to inspect navigation, search, or component
pages. The site uses hash routing, so `index.html` can be served from any static host.

For the full picture of what the generator emits, see the source under `src/generator/` and the
parity fixtures under `tests/fixtures/parity/`.
