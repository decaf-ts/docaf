import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { REPO_ROOT } from "../support/harness";

const COMPONENTS_ROOT = path.join(
  REPO_ROOT,
  "src",
  "for-angular",
  "components"
);

interface AngularComponentSource {
  file: string;
  className: string;
  selector: string;
  templateUrl: string;
  styleUrl: string;
  template: string;
  style: string;
  hasInlineTemplate: boolean;
  hasInlineStyles: boolean;
  standalone: boolean;
  exported: boolean;
  extendsBase?: string;
  importsRouterLink: boolean;
}

function componentFiles(): string[] {
  return fs
    .readdirSync(COMPONENTS_ROOT, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".component.ts"))
    .map((entry) => path.join(COMPONENTS_ROOT, entry))
    .sort();
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

function property(
  object: ts.ObjectLiteralExpression,
  name: string
): ts.PropertyAssignment | undefined {
  return object.properties.find(
    (entry): entry is ts.PropertyAssignment =>
      ts.isPropertyAssignment(entry) && propertyName(entry.name) === name
  );
}

function stringProperty(
  object: ts.ObjectLiteralExpression,
  name: string
): string | undefined {
  const initializer = property(object, name)?.initializer;
  return initializer && ts.isStringLiteral(initializer)
    ? initializer.text
    : undefined;
}

function componentSource(file: string): AngularComponentSource {
  const text = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const declarations = sourceFile.statements.filter(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement)
  );

  for (const declaration of declarations) {
    for (const decorator of ts.getDecorators(declaration) ?? []) {
      const expression = decorator.expression;
      if (
        !ts.isCallExpression(expression) ||
        !ts.isIdentifier(expression.expression) ||
        expression.expression.text !== "Component"
      )
        continue;

      const metadata = expression.arguments[0];
      if (!metadata || !ts.isObjectLiteralExpression(metadata))
        throw new Error(`Missing @Component metadata in ${file}`);

      const templateUrl = stringProperty(metadata, "templateUrl");
      const styleUrl = stringProperty(metadata, "styleUrl");
      if (!templateUrl || !styleUrl)
        throw new Error(`Missing templateUrl/styleUrl in ${file}`);

      const standalone = property(metadata, "standalone")?.initializer;
      const heritage = declaration.heritageClauses?.find(
        (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
      )?.types[0];
      const extendsBase =
        heritage && ts.isIdentifier(heritage.expression)
          ? heritage.expression.text
          : undefined;
      const exported = (ts.getModifiers(declaration) ?? []).some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );

      return {
        file,
        className: declaration.name?.text ?? "",
        selector: stringProperty(metadata, "selector") ?? "",
        templateUrl,
        styleUrl,
        template: fs.readFileSync(
          path.resolve(path.dirname(file), templateUrl),
          "utf8"
        ),
        style: fs.readFileSync(
          path.resolve(path.dirname(file), styleUrl),
          "utf8"
        ),
        hasInlineTemplate: Boolean(property(metadata, "template")),
        hasInlineStyles:
          Boolean(property(metadata, "styles")) ||
          Boolean(property(metadata, "styleUrls")),
        standalone:
          standalone?.kind === ts.SyntaxKind.TrueKeyword,
        exported,
        extendsBase,
        importsRouterLink:
          /import\s*\{[^}]*\bRouterLink\b[^}]*\}\s*from\s*"@angular\/router"/s.test(
            text
          ),
      };
    }
  }

  throw new Error(`No @Component class found in ${file}`);
}

const COMPONENTS = componentFiles().map(componentSource);

describe("dedicated docs Angular component sources", () => {
  it("ships one dedicated component per folder", () => {
    expect(COMPONENTS).toHaveLength(33);
    expect(new Set(COMPONENTS.map((component) => component.file)).size).toBe(
      COMPONENTS.length
    );
    for (const component of COMPONENTS) {
      expect(component.className).toMatch(/^Docs[A-Za-z]+Component$/);
      expect(component.exported).toBe(true);
      expect(component.standalone).toBe(true);
      expect(component.extendsBase).toMatch(/^Docs(?:Block|Page)Base$/);
    }
  });

  it("resolves templates and styles from non-empty sibling files", () => {
    for (const component of COMPONENTS) {
      const base = path.basename(component.file, ".component.ts");
      expect(component.templateUrl).toBe(`./${base}.component.html`);
      expect(component.styleUrl).toBe(`./${base}.component.css`);
      expect(component.template.trim().length).toBeGreaterThan(0);
      expect(component.style.trim().length).toBeGreaterThan(0);
    }
  });

  it("declares no inline template or styles metadata", () => {
    for (const component of COMPONENTS) {
      expect(component.hasInlineTemplate).toBe(false);
      expect(component.hasInlineStyles).toBe(false);
    }
  });

  it("uses hash-safe RouterLink bindings in every routed component", () => {
    for (const component of COMPONENTS) {
      if (!component.importsRouterLink) continue;
      expect(component.template).toContain("[routerLink]");
      expect(component.template).not.toMatch(/href\s*=\s*["']#/);
      if (/\banchor\b/.test(component.template))
        expect(component.template).toContain("[fragment]");
    }
  });

  it("selectors are unique docs-* element names", () => {
    const selectors = COMPONENTS.map((component) => component.selector);
    for (const selector of selectors)
      expect(selector).toMatch(/^docs-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(new Set(selectors).size).toBe(selectors.length);
  });
});

describe("generic docs page source dispatch", () => {
  const GENERIC_PAGE_FILE = path.join(
    COMPONENTS_ROOT,
    "docs-generic-page",
    "docs-generic-page.component.ts"
  );

  it("dispatches home, component, tutorial, source and class-like pages in order", () => {
    const generic = componentSource(GENERIC_PAGE_FILE);
    const template = generic.template.replace(/\s+/g, " ");

    const branches: readonly (readonly [string, string])[] = [
      ['@if (pageKind === "home")', "docs-home-page"],
      ["@else if (previewBlock)", "docs-component-page"],
      ["@else if (tutorialBlock)", "docs-tutorial-page"],
      ["@else if (sourceBlock)", "docs-source-page"],
      ["@else if (breadcrumbsBlock)", "docs-class-page"],
    ];

    let previous = -1;
    for (const [condition, selector] of branches) {
      const conditionAt = template.indexOf(condition);
      expect(conditionAt).toBeGreaterThan(previous);
      const selectorAt = template.indexOf(`<${selector}`, conditionAt);
      expect(selectorAt).toBeGreaterThan(conditionAt);
      previous = conditionAt;
    }
  });

  it("renders the remaining blocks as the generic fallback", () => {
    const generic = componentSource(GENERIC_PAGE_FILE);
    const template = generic.template.replace(/\s+/g, " ");

    const fallbackAt = template.indexOf("@else");
    const loopAt = template.indexOf(
      "@for (block of contentBlocks; track $index)",
      fallbackAt
    );
    const rendererAt = template.indexOf(
      '<ngx-decaf-component-renderer [tag]="block.tag" [globals]="block"',
      loopAt
    );

    expect(fallbackAt).toBeGreaterThan(-1);
    expect(loopAt).toBeGreaterThan(fallbackAt);
    expect(rendererAt).toBeGreaterThan(loopAt);
  });
});

describe("docs page host source", () => {
  const HOST_FILE = path.join(
    REPO_ROOT,
    "src",
    "for-angular",
    "routing",
    "docs-page-host",
    "docs-page-host.component.ts"
  );
  const LEGACY_HOST_FILE = path.join(
    REPO_ROOT,
    "src",
    "for-angular",
    "routing",
    "DocsPageHostComponent.ts"
  );

  it("uses sibling templateUrl and styleUrl files with no inline template or styles", () => {
    const host = componentSource(HOST_FILE);

    expect(host.className).toBe("DocsPageHostComponent");
    expect(host.selector).toBe("docs-page-host");
    expect(host.standalone).toBe(true);
    expect(host.templateUrl).toBe("./docs-page-host.component.html");
    expect(host.styleUrl).toBe("./docs-page-host.component.css");
    expect(host.hasInlineTemplate).toBe(false);
    expect(host.hasInlineStyles).toBe(false);
    expect(host.template.trim().length).toBeGreaterThan(0);
    expect(host.style.trim().length).toBeGreaterThan(0);
    expect(host.template).toContain("ngx-decaf-model-renderer");
  });

  it("lives in routing/docs-page-host and is exported from the new entrypoint", () => {
    const entrypoint = fs.readFileSync(
      path.join(REPO_ROOT, "src", "for-angular", "index.ts"),
      "utf8"
    );

    expect(fs.existsSync(HOST_FILE)).toBe(true);
    expect(fs.existsSync(LEGACY_HOST_FILE)).toBe(false);
    expect(entrypoint).toContain(
      '"./routing/docs-page-host/docs-page-host.component"'
    );
  });
});

describe("docs sections source dispatch", () => {
  const SECTIONS_FILE = path.join(
    COMPONENTS_ROOT,
    "docs-sections",
    "docs-sections.component.ts"
  );

  it("dispatches kind=source sections to the dedicated docs-source block", () => {
    const sections = componentSource(SECTIONS_FILE);
    const template = sections.template.replace(/\s+/g, " ");

    const sourceBranchAt = template.indexOf('section.kind === "source"');
    const sourceBlockAt = template.indexOf(
      '<docs-source [value]="sourceValue(section)"></docs-source>'
    );

    expect(sourceBranchAt).toBeGreaterThan(-1);
    expect(sourceBlockAt).toBeGreaterThan(sourceBranchAt);
  });

  it("no longer renders the fallback source-reference paragraph", () => {
    const sections = componentSource(SECTIONS_FILE);
    const template = sections.template.replace(/\s+/g, " ");

    expect(template).not.toContain("docs-source-reference");
    expect(template).not.toContain("Defined in");
  });
});
