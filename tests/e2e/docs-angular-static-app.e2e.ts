import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Script } from "node:vm";

import { Logging } from "@decaf-ts/logging";
import { DocsDatabase } from "../../lib/esm/database/index.js";
import { DocumentationCompiler } from "../../lib/esm/generator/compiler/DocumentationCompiler.js";
import { AngularDocsBuildTarget } from "../../lib/esm/build/index.js";

const log = Logging.for("docaf e2e");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECT = { name: "@fixture/adapter", version: "1.0.0" };
const SLICE = path.join(ROOT, "tests/fixtures/vertical-slice/src");
const NATIVE_PREVIEW = path.join(ROOT, "tests/fixtures/native-preview/src");
const OVERFLOW_SLICE = path.join(
  ROOT,
  "tests/fixtures/overflow-regression/src"
);
const DOCAF_SOURCE = path.join(ROOT, "src");
const INDEXED_SYMBOL_PROBES: readonly (readonly [string, string])[] = [
  ["DocsPreviewComponent", "component"],
  ["DocsPageService", "class"],
  ["AngularDocsBuildTargetOptions", "interface"],
  ["composeSignature", "function"],
  ["slugify", "function"],
  ["configFingerprint", "function"],
  ["searchIndex", "member"],
];
const ARTIFACTS = path.join(ROOT, "tmp/e2e-artifacts");
const CLASS_ROUTE = "/#/docs/classes/RamAdapter";
const COMPONENT_ROUTE = "/#/docs/components/DocWidgetComponent";
const NARROW_VIEWPORT = { width: 390, height: 844 };
const OVERFLOW_CLASS_ROUTE = "/#/docs/classes/RamAdapter";
const OVERFLOW_FUNCTION_ROUTE =
  "/#/docs/functions/createAdapterDescriptorWithLongConfigurationChain";
const OVERFLOW_INTERFACE_ROUTE = "/#/docs/interfaces/AdapterConfig";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

type Evidence = Record<string, unknown>;
type Result = {
  name: string;
  ok: boolean;
  evidence?: Evidence;
  error?: string;
};

function playwright(): any {
  const root = process.env.PLAYWRIGHT_ROOT;
  if (root) {
    const requireFrom = createRequire(path.join(root, "package.json"));
    return requireFrom("playwright");
  }
  return createRequire(import.meta.url)("playwright");
}

function axeModule(): any {
  return createRequire(import.meta.url)("@axe-core/playwright");
}

function axeFailure(violations: any[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node: any) => node.target.join(" "))
          .join(", ")}`
    )
    .join("; ");
}

function staticServer(directory: string) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const requested = decodeURIComponent(url.pathname);
    const relative = requested === "/" ? "index.html" : requested.slice(1);
    const file = path.join(directory, relative);
    if (!file.startsWith(directory)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await fs.readFile(file);
      response.writeHead(200, {
        "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
}

async function buildApp(
  name: string,
  sourceDirectory: string,
  options: { baseHref?: string } = {}
): Promise<{
  baseUrl: string;
  output: string;
  snapshot: any;
  close: () => Promise<void>;
}> {
  const output = path.join(ROOT, `tmp/e2e-angular-docs-${name}`);
  const snapshotPath = path.join(ROOT, `tmp/e2e-${name}-snapshot.json`);
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  const database = new DocsDatabase();
  const compiler = new DocumentationCompiler({
    project: PROJECT,
    rootNames: [sourceDirectory],
    database,
    snapshot: { id: `e2e-${name}`, sourceRevision: "local" },
  });
  const result = await compiler.build(database);
  await fs.writeFile(
    snapshotPath,
    JSON.stringify(result.snapshot, null, 2),
    "utf8"
  );
  const target = new AngularDocsBuildTarget({
    packageRoot: ROOT,
    configuration: "development",
  });
  const context = {
    projectRoot: sourceDirectory,
    snapshotPath,
    outputDirectory: output,
    config: {
      project: { name: PROJECT.name },
      output: { baseHref: options.baseHref ?? "/" },
    },
    components: result.extraction.components,
    previews: [],
    layouts: await database.layouts.select().execute(),
  };
  await target.validate(context as never);
  await target.prepare(context as never);
  await target.build(context as never);

  const server = staticServer(output);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Static docs test server did not expose a port");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    output,
    snapshot: result.snapshot,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  };
}

function expectedSearchEntries(snapshot: {
  tables: {
    doclets: { metadata?: Record<string, string>; linkId?: string }[];
    tutorials: unknown[];
  };
}): number {
  const searchableDoclets = snapshot.tables.doclets.filter(
    (doclet) =>
      doclet.metadata?.undocumented !== "true" && Boolean(doclet.linkId)
  );
  return searchableDoclets.length + snapshot.tables.tutorials.length;
}

function collector(page: any) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error: Error) => pageErrors.push(error.message));
  page.on("console", (message: any) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("NG0955")) return;
    consoleErrors.push(text.slice(0, 300));
  });
  return { pageErrors, consoleErrors };
}

async function assertDedicatedSourceBlock(
  page: any,
  route: string,
  expectedPath: string
): Promise<Evidence> {
  await page.goto(route, { waitUntil: "networkidle" });
  const section = page.locator(".docs-section-source").first();
  await section.waitFor({ state: "visible", timeout: 5000 });
  const docsSource = section.locator("docs-source").first();
  await docsSource.waitFor({ state: "visible", timeout: 5000 });
  const pathText = (
    await docsSource.locator(".docs-source-file code").first().innerText()
  ).trim();
  assert.ok(
    pathText.includes(expectedPath),
    `dedicated docs-source did not identify ${expectedPath}; observed: ${JSON.stringify(
      pathText
    )}`
  );
  const fallbackParagraphs = await section
    .locator(".docs-source-reference")
    .count();
  assert.equal(
    fallbackParagraphs,
    0,
    "source section still rendered the fallback docs-source-reference paragraph"
  );
  const sectionText = (await section.innerText()).trim();
  assert.ok(
    !sectionText.includes("Defined in"),
    `source section still rendered the "Defined in" fallback text: ${JSON.stringify(
      sectionText
    )}`
  );
  const pageSourceBlocks = await page.locator("docs-source").count();
  assert.ok(
    pageSourceBlocks > 0,
    "the page rendered no dedicated docs-source elements"
  );
  return {
    route,
    tag: await docsSource.evaluate((element: Element) =>
      element.tagName.toLowerCase()
    ),
    path: pathText,
    fallbackParagraphs,
    pageSourceBlocks,
  };
}

async function assertResponsiveDocsNavigation(
  page: any,
  route: string,
  viewport: { width: number; height: number }
): Promise<Evidence> {
  await page.goto(route, { waitUntil: "networkidle" });
  const nav = page.locator(".docs-nav").first();
  await nav.waitFor({ state: "visible", timeout: 5000 });
  const link = page
    .locator(".docs-nav a", { hasText: "AdapterConfig" })
    .first();
  await link.waitFor({ state: "visible", timeout: 5000 });
  assert.ok(await nav.isVisible(), "docs navigation is not visible");
  assert.ok(await link.isVisible(), "docs navigation link is not visible");
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(
    overflow.document <= overflow.viewport + 1,
    `document overflows horizontally at ${viewport.width}x${viewport.height}: ${JSON.stringify(
      overflow
    )}`
  );
  assert.ok(
    overflow.body <= overflow.viewport + 1,
    `body overflows horizontally at ${viewport.width}x${viewport.height}: ${JSON.stringify(
      overflow
    )}`
  );
  await link.click();
  await page.waitForURL(/#\/docs\/interfaces\/AdapterConfig$/);
  const heading = page.getByRole("heading", {
    name: "AdapterConfig",
    level: 1,
  });
  await heading.waitFor({ state: "visible" });
  return {
    viewport,
    overflow,
    navVisible: true,
    url: page.url(),
    heading: await heading.textContent(),
  };
}

type OverflowRequirement = "wideTable" | "longCode";

async function assertNarrowViewportContainment(
  page: any,
  route: string,
  requirements: OverflowRequirement[] = [],
  expectedHeading?: string
): Promise<Evidence> {
  await page.goto(route, { waitUntil: "networkidle" });
  await page
    .locator(".docs-nav")
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
  await page
    .locator(".docs-page")
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
  if (expectedHeading) {
    await page
      .getByRole("heading", { name: expectedHeading, level: 1 })
      .waitFor({ state: "visible", timeout: 15000 });
  }
  await page.waitForTimeout(250);
  const audit = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const scrollableOverflow = new Set(["auto", "scroll", "hidden", "clip"]);
    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : "";
      const classes = Array.from(element.classList)
        .slice(0, 3)
        .map((name) => `.${name}`)
        .join("");
      return `${tag}${id}${classes}`;
    };
    const isScrollContainer = (element: Element): boolean => {
      const style = getComputedStyle(element);
      return (
        scrollableOverflow.has(style.overflowX) &&
        element.scrollWidth > element.clientWidth + 1
      );
    };
    const clippedByScrollContainer = (element: Element): boolean => {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.documentElement) {
        if (isScrollContainer(ancestor)) return true;
        ancestor = ancestor.parentElement;
      }
      return false;
    };
    const measure = (selector: string) =>
      Array.from(document.querySelectorAll(selector)).map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          element: describe(element),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowX: style.overflowX,
          right: Math.round(rect.right * 100) / 100,
          visible: Boolean(rect.width || rect.height),
        };
      });

    const offenders: {
      element: string;
      right: number;
      width: number;
      text: string;
    }[] = [];
    let excludedClipped = 0;
    let excludedSkipLink = 0;
    for (const element of Array.from(document.querySelectorAll("body *"))) {
      if (element.matches("a.docs-skip-link")) {
        excludedSkipLink += 1;
        continue;
      }
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = element.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      if (rect.right <= viewportWidth + 1) continue;
      if (clippedByScrollContainer(element)) {
        excludedClipped += 1;
        continue;
      }
      offenders.push({
        element: describe(element),
        right: Math.round(rect.right * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        text: (element.textContent ?? "").trim().slice(0, 100),
      });
    }

    return {
      url: window.location.href,
      heading: document.querySelector("h1")?.textContent?.trim() ?? null,
      viewportWidth,
      scrollingElementScrollWidth: document.scrollingElement
        ? document.scrollingElement.scrollWidth
        : null,
      documentElementScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders,
      excludedClipped,
      excludedSkipLink,
      tableWraps: measure(".docs-table-wrap"),
      codeBlocks: measure("pre.docs-code"),
    };
  });

  if (expectedHeading) {
    assert.equal(
      audit.heading,
      expectedHeading,
      `narrow-viewport page rendered the wrong heading: ${JSON.stringify(audit)}`
    );
  }
  assert.ok(
    audit.scrollingElementScrollWidth !== null &&
      audit.scrollingElementScrollWidth <= audit.viewportWidth + 1,
    `document.scrollingElement overflows horizontally at 390x844: ${JSON.stringify(
      audit
    )}`
  );
  assert.ok(
    audit.documentElementScrollWidth <= audit.viewportWidth + 1,
    `document.documentElement overflows horizontally at 390x844: ${JSON.stringify(
      audit
    )}`
  );
  assert.ok(
    audit.bodyScrollWidth <= audit.viewportWidth + 1,
    `document.body overflows horizontally at 390x844: ${JSON.stringify(audit)}`
  );
  assert.deepEqual(
    audit.offenders,
    [],
    `visible elements extend past the 390px viewport edge: ${JSON.stringify(
      audit.offenders
    )}`
  );

  const internalScrollers = (entries: typeof audit.tableWraps) =>
    entries.filter(
      (entry) =>
        entry.visible &&
        entry.scrollWidth > entry.clientWidth + 1 &&
        entry.overflowX === "auto"
    );
  const wideTables = internalScrollers(audit.tableWraps);
  const longCodeBlocks = internalScrollers(audit.codeBlocks);

  if (requirements.includes("wideTable")) {
    assert.ok(
      wideTables.length > 0,
      `no .docs-table-wrap scrolled internally at 390x844; observed: ${JSON.stringify(
        audit.tableWraps
      )}`
    );
  }
  if (requirements.includes("longCode")) {
    assert.ok(
      longCodeBlocks.length > 0,
      `no pre.docs-code scrolled internally at 390x844; observed: ${JSON.stringify(
        audit.codeBlocks
      )}`
    );
  }

  return {
    route,
    viewport: NARROW_VIEWPORT,
    heading: audit.heading,
    scrollWidths: {
      scrollingElement: audit.scrollingElementScrollWidth,
      documentElement: audit.documentElementScrollWidth,
      body: audit.bodyScrollWidth,
      clientWidth: audit.viewportWidth,
    },
    offenders: audit.offenders,
    excludedClipped: audit.excludedClipped,
    excludedSkipLink: audit.excludedSkipLink,
    wideTables,
    longCodeBlocks,
  };
}

async function main(): Promise<void> {
  await fs.mkdir(ARTIFACTS, { recursive: true });
  const apps: { close: () => Promise<void> }[] = [];
  let browser: any;
  let built: { baseUrl: string; output: string } | undefined;
  let nativeBuilt: { baseUrl: string; output: string } | undefined;
  let fileBuilt: { baseUrl: string; output: string } | undefined;
  let overflowBuilt: { baseUrl: string; output: string } | undefined;
  let docafBuilt:
    | { baseUrl: string; output: string; snapshot: any }
    | undefined;
  const results: Result[] = [];

  const test = async (
    name: string,
    run: (page: any) => Promise<Evidence>,
    options: {
      allowConsoleErrors?: RegExp[];
      viewport?: { width: number; height: number };
    } = {}
  ): Promise<void> => {
    const context = await browser.newContext({
      viewport: options.viewport ?? { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors = collector(page);
    try {
      const evidence = await run(page);
      const allowed = options.allowConsoleErrors ?? [];
      const unexpectedConsoleErrors = errors.consoleErrors.filter(
        (message) => !allowed.some((pattern) => pattern.test(message))
      );
      assert.deepEqual(errors.pageErrors, [], "uncaught page errors");
      assert.deepEqual(unexpectedConsoleErrors, [], "console errors");
      results.push({ name, ok: true, evidence });
    } catch (error) {
      results.push({
        name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await context.close();
    }
  };

  try {
    process.stderr.write("building slice docs app\n");
    built = await buildApp("slice", SLICE);
    apps.push(built);
    process.stderr.write("building overflow-regression docs app\n");
    overflowBuilt = await buildApp("overflow-regression", OVERFLOW_SLICE);
    apps.push(overflowBuilt);
    process.stderr.write("building native-preview docs app\n");
    nativeBuilt = await buildApp("native-preview", NATIVE_PREVIEW);
    apps.push(nativeBuilt);
    process.stderr.write("building file-mode docs app\n");
    fileBuilt = await buildApp("file-mode", SLICE, { baseHref: "./" });
    apps.push(fileBuilt);
    process.stderr.write("building docaf self-hosted docs app\n");
    docafBuilt = await buildApp("docaf", DOCAF_SOURCE);
    apps.push(docafBuilt);
    process.stderr.write("launching browser\n");
    const { chromium } = playwright();
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"],
    });

    await test("class page renders heading and Methods section", async (page) => {
      await page.goto(`${built!.baseUrl}${CLASS_ROUTE}`, {
        waitUntil: "networkidle",
      });
      const heading = page.getByRole("heading", {
        name: "RamAdapter",
        level: 1,
      });
      await heading.waitFor({ state: "visible" });
      const methods = page.getByRole("heading", { name: "Methods", exact: true });
      await methods.waitFor({ state: "visible", timeout: 5000 });
      return {
        heading: await heading.textContent(),
        methods: await methods.textContent(),
      };
    });

    await test("class page renders a dedicated docs-source block naming adapter.ts", (page) =>
      assertDedicatedSourceBlock(
        page,
        `${built!.baseUrl}${CLASS_ROUTE}`,
        "adapter.ts"
      )
    );

    await test("anchored method read exists, is visible, and scrolls into view", async (page) => {
      await page.goto(`${built!.baseUrl}${CLASS_ROUTE}`, {
        waitUntil: "networkidle",
      });
      const methods = page.locator(".docs-section#section-members").first();
      await methods.waitFor({ state: "visible", timeout: 5000 });
      const member = page.locator(".docs-member#read").first();
      await member.waitFor({ state: "visible", timeout: 5000 });
      const methodsText = await methods.innerText();
      assert.ok(
        methodsText.includes("read"),
        `Methods section did not list read: ${methodsText}`
      );
      await member.scrollIntoViewIfNeeded();
      const box = await member.boundingBox();
      const viewport = page.viewportSize();
      assert.ok(
        box &&
          viewport &&
          box.y >= 0 &&
          box.y + box.height <= viewport.height + 1,
        `#read was not in the viewport after scrolling: ${JSON.stringify({
          box,
          viewport,
        })}`
      );
      return {
        anchor: await member.getAttribute("id"),
        text: (await member.innerText()).trim(),
        box,
        viewport,
      };
    });

    await test("in-page Methods anchor link resolves to its section target", async (page) => {
      await page.goto(`${built!.baseUrl}${CLASS_ROUTE}`, {
        waitUntil: "networkidle",
      });
      const link = page
        .locator(".docs-toc a", { hasText: "Methods" })
        .first();
      await link.waitFor({ state: "visible", timeout: 5000 });
      await link.click();
      await page.waitForTimeout(500);
      const state = await page.evaluate(() => {
        const target = document.querySelector("#section-members");
        const rect = target?.getBoundingClientRect();
        return {
          hash: window.location.hash,
          href: window.location.href,
          scrollY: window.scrollY,
          targetFound: Boolean(target),
          targetTop: rect?.top ?? null,
          targetInViewport: rect
            ? rect.top >= -1 && rect.top < window.innerHeight
            : false,
          sectionIds: Array.from(
            document.querySelectorAll(".docs-section")
          ).map((section) => section.id),
          heading: document.querySelector("h1")?.textContent ?? null,
          pageError:
            document.querySelector(".docs-page-error")?.textContent ?? null,
        };
      });
      assert.ok(
        state.hash.includes("section-members"),
        `in-page anchor did not resolve to section-members: ${JSON.stringify(
          state
        )}`
      );
      assert.ok(
        state.targetFound,
        `in-page anchor target is missing after navigation: ${JSON.stringify(
          state
        )}`
      );
      const target = page.locator("#section-members").first();
      const box = await target.boundingBox();
      const viewport = page.viewportSize();
      return { ...state, url: page.url(), box, viewport };
    });

    await test("class page has no serious or critical axe violations", async (page) => {
      await page.goto(`${built!.baseUrl}${CLASS_ROUTE}`, {
        waitUntil: "networkidle",
      });
      await page
        .getByRole("heading", { name: "RamAdapter", level: 1 })
        .waitFor({ state: "visible" });
      const { AxeBuilder } = axeModule();
      const analysis = await new AxeBuilder({ page }).analyze();
      const blocking = analysis.violations.filter(
        (violation: any) =>
          violation.impact === "serious" || violation.impact === "critical"
      );
      assert.equal(
        blocking.length,
        0,
        `axe found serious/critical violations on the class page: ${axeFailure(blocking)}`
      );
      return {
        url: page.url(),
        violationIds: analysis.violations.map((violation: any) => violation.id),
        seriousCritical: blocking.length,
      };
    });

    await test("sidebar navigation navigates to another page", async (page) => {
      await page.goto(`${built!.baseUrl}${CLASS_ROUTE}`, {
        waitUntil: "networkidle",
      });
      await page
        .locator(".docs-nav a", { hasText: "AdapterConfig" })
        .first()
        .click();
      await page.waitForURL(/#\/docs\/interfaces\/AdapterConfig$/);
      const heading = page.getByRole("heading", {
        name: "AdapterConfig",
        level: 1,
      });
      await heading.waitFor({ state: "visible" });
      return { url: page.url(), heading: await heading.textContent() };
    });

    await test(
      "responsive navigation is visible and usable at 1440x1000",
      (page) =>
        assertResponsiveDocsNavigation(page, `${built!.baseUrl}${CLASS_ROUTE}`, {
          width: 1440,
          height: 1000,
        }),
      { viewport: { width: 1440, height: 1000 } }
    );

    await test(
      "responsive navigation is visible and usable at 390x844 without horizontal overflow",
      (page) =>
        assertResponsiveDocsNavigation(page, `${built!.baseUrl}${CLASS_ROUTE}`, {
          width: 390,
          height: 844,
        }),
      { viewport: { width: 390, height: 844 } }
    );

    const narrowOverflowRoutes: {
      name: string;
      route: string;
      requirements: OverflowRequirement[];
      heading?: string;
    }[] = [
      {
        name: "home page has no horizontal overflow or clipped-past-viewport elements at 390x844",
        route: "/",
        requirements: [],
      },
      {
        name: "class page keeps its wide member table and long code line internally scrollable at 390x844",
        route: OVERFLOW_CLASS_ROUTE,
        requirements: ["wideTable", "longCode"],
        heading: "RamAdapter",
      },
      {
        name: "function page keeps its long example code internally scrollable at 390x844",
        route: OVERFLOW_FUNCTION_ROUTE,
        requirements: ["longCode"],
        heading: "createAdapterDescriptorWithLongConfigurationChain",
      },
      {
        name: "interface page keeps its wide member table internally scrollable at 390x844",
        route: OVERFLOW_INTERFACE_ROUTE,
        requirements: ["wideTable"],
        heading: "AdapterConfig",
      },
    ];

    for (const entry of narrowOverflowRoutes) {
      await test(
        entry.name,
        (page) =>
          assertNarrowViewportContainment(
            page,
            `${overflowBuilt!.baseUrl}${entry.route}`,
            entry.requirements,
            entry.heading
          ),
        { viewport: NARROW_VIEWPORT }
      );
    }

    await test("keyboard tab reaches a sidebar link and Enter navigates", async (page) => {
      await page.goto(`${built!.baseUrl}${CLASS_ROUTE}`, {
        waitUntil: "networkidle",
      });
      await page
        .getByRole("heading", { name: "RamAdapter", level: 1 })
        .waitFor({ state: "visible" });
      const visited: string[] = [];
      let focused: Record<string, unknown> | undefined;
      for (let step = 0; step < 80; step += 1) {
        await page.keyboard.press("Tab");
        focused = await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null;
          if (!element) return undefined;
          const style = getComputedStyle(element);
          return {
            tag: element.tagName,
            text: (element.textContent ?? "").trim().slice(0, 80),
            nav: Boolean(element.closest(".docs-nav")),
            focusVisible: element.matches(":focus-visible"),
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            boxShadow: style.boxShadow,
          };
        });
        if (!focused) continue;
        visited.push(`${String(focused.tag)}:${String(focused.text)}`);
        if (focused.nav && String(focused.text).includes("AdapterConfig")) break;
      }
      assert.ok(
        focused && focused.nav && String(focused.text).includes("AdapterConfig"),
        `Tab did not reach the AdapterConfig sidebar link; visited: ${visited.join(
          " > "
        )}`
      );
      assert.ok(
        focused.focusVisible === true,
        `focused sidebar link is not :focus-visible: ${JSON.stringify(focused)}`
      );
      assert.ok(
        focused.outlineStyle !== "none" ||
          focused.outlineWidth !== "0px" ||
          focused.boxShadow !== "none",
        `focused sidebar link has no visible focus indicator: ${JSON.stringify(
          focused
        )}`
      );
      await page.keyboard.press("Enter");
      await page.waitForURL(/#\/docs\/interfaces\/AdapterConfig$/);
      const heading = page.getByRole("heading", {
        name: "AdapterConfig",
        level: 1,
      });
      await heading.waitFor({ state: "visible" });
      return {
        focused,
        visited,
        url: page.url(),
        heading: await heading.textContent(),
      };
    });

    await test("browser reload rehydrates RamAdapter from the snapshot", async (page) => {
      const snapshotStatuses: number[] = [];
      page.on("response", (response: any) => {
        if (response.url().includes("assets/docs/snapshot.json"))
          snapshotStatuses.push(response.status());
      });
      await page.goto(`${built!.baseUrl}${CLASS_ROUTE}`, {
        waitUntil: "networkidle",
      });
      await page.reload({ waitUntil: "networkidle" });
      const heading = page.getByRole("heading", {
        name: "RamAdapter",
        level: 1,
      });
      await heading.waitFor({ state: "visible" });
      assert.ok(
        snapshotStatuses.length > 0,
        "the reload did not request assets/docs/snapshot.json"
      );
      assert.ok(
        snapshotStatuses.every((status) => status === 200),
        `snapshot requests failed: ${snapshotStatuses.join(", ")}`
      );
      assert.equal(await page.locator(".docs-page-error").count(), 0);
      return { snapshotStatuses, heading: await heading.textContent() };
    });

    await test("file-mode output is a classic non-module bundle", async () => {
      const output = fileBuilt!.output;
      const html = await fs.readFile(path.join(output, "index.html"), "utf8");
      assert.ok(
        !/type\s*=\s*["']module["']/i.test(html),
        `file-mode index.html still declares a module script: ${html.slice(0, 500)}`
      );
      assert.ok(
        !html.includes("modulepreload"),
        "file-mode index.html still contains a modulepreload link"
      );
      assert.ok(
        html.includes('<base href="./">'),
        `file-mode index.html is missing <base href="./">: ${html.slice(0, 500)}`
      );
      const scripts = [
        'src="assets/docs/snapshot.js"',
        'src="assets/i18n/en.js"',
        'src="file-protocol-shim.js"',
        'src="main.js"',
      ];
      let cursor = -1;
      for (const script of scripts) {
        const index = html.indexOf(script);
        assert.ok(
          index > cursor,
          `file-mode index.html is missing ${script} or has it out of order`
        );
        cursor = index;
      }
      const entries = await fs.readdir(output);
      assert.ok(entries.includes("main.js"), "file-mode output has no main.js");
      assert.ok(
        entries.includes("file-protocol-shim.js"),
        "file-mode output has no file-protocol-shim.js"
      );
      const hashed = entries.filter((entry) =>
        /^(?:chunk-.*|main-[^.]+|polyfills-[^.]+)\.(?:js|js\.map)$/.test(entry)
      );
      assert.deepEqual(
        hashed,
        [],
        `file-mode output still contains non-classic bundles: ${hashed.join(", ")}`
      );
      const main = await fs.readFile(path.join(output, "main.js"), "utf8");
      assert.doesNotThrow(
        () => new Script(main, { filename: "main.js" }),
        "file-mode main.js is not a classic script"
      );
      return {
        output,
        baseHref: './',
        scripts,
        entries,
        mainBytes: main.length,
      };
    });

    await test("file:// direct open renders class and interface pages and survives reload", async (page) => {
      const fileUrl = pathToFileURL(path.join(fileBuilt!.output, "index.html"));
      fileUrl.hash = CLASS_ROUTE.replace(/^\//, "");
      const failedRequests: string[] = [];
      page.on("requestfailed", (request: any) => {
        failedRequests.push(
          `${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`
        );
      });

      await page.goto(fileUrl.href, { waitUntil: "load" });
      const classHeading = page.getByRole("heading", {
        name: "RamAdapter",
        level: 1,
      });
      await classHeading.waitFor({ state: "visible", timeout: 10000 });
      const initial = await page.evaluate(() => ({
        protocol: location.protocol,
        hash: location.hash,
        heading: document.querySelector("h1")?.textContent ?? null,
        pageError:
          document.querySelector(".docs-page-error")?.textContent ?? null,
        snapshotLoaded: Boolean(
          (globalThis as Record<string, unknown>).__DOCAF_DOCS_SNAPSHOT__
        ),
        i18nLoaded: Boolean(
          (globalThis as Record<string, unknown>).__DOCAF_DOCS_I18N__
        ),
      }));
      assert.equal(initial.protocol, "file:");
      assert.equal(initial.hash, "#/docs/classes/RamAdapter");
      assert.equal(initial.heading, "RamAdapter");
      assert.equal(initial.pageError, null);
      assert.equal(initial.snapshotLoaded, true);
      assert.equal(initial.i18nLoaded, true);

      await page
        .locator(".docs-nav a", { hasText: "AdapterConfig" })
        .first()
        .click();
      await page.waitForURL(/#\/docs\/interfaces\/AdapterConfig$/);
      const interfaceHeading = page.getByRole("heading", {
        name: "AdapterConfig",
        level: 1,
      });
      await interfaceHeading.waitFor({ state: "visible", timeout: 10000 });
      const navigated = page.url();

      await page.reload({ waitUntil: "load" });
      await page
        .getByRole("heading", { name: "AdapterConfig", level: 1 })
        .waitFor({ state: "visible", timeout: 10000 });
      const reloaded = await page.evaluate(() => ({
        hash: location.hash,
        heading: document.querySelector("h1")?.textContent ?? null,
        pageError:
          document.querySelector(".docs-page-error")?.textContent ?? null,
      }));
      assert.equal(reloaded.hash, "#/docs/interfaces/AdapterConfig");
      assert.equal(reloaded.heading, "AdapterConfig");
      assert.equal(reloaded.pageError, null);
      assert.deepEqual(failedRequests, [], "file:// requests failed");
      return {
        file: fileUrl.href,
        initial,
        navigated,
        reloaded,
        failedRequests,
      };
    });

    await test("sidebar search filters and navigates", async (page) => {
      await page.goto(`${built!.baseUrl}${CLASS_ROUTE}`, {
        waitUntil: "networkidle",
      });
      const input = page.locator(".docs-search-input").first();
      await input.fill("widget");
      const results = page.locator(".docs-search-results li");
      await results.first().waitFor({ state: "visible" });
      assert.ok((await results.count()) >= 1, "search returned no results");
      const filtered = await results.allInnerTexts();
      assert.ok(
        filtered.some((text: string) => text.includes("DocWidgetComponent")),
        `search results did not include DocWidgetComponent: ${filtered.join(" | ")}`
      );
      assert.ok(
        filtered.every((text: string) => !text.includes("RamAdapter")),
        "widget search did not filter out RamAdapter"
      );
      await page
        .locator(".docs-search-results a", { hasText: "DocWidgetComponent" })
        .first()
        .click();
      await page.waitForURL(/#\/docs\/components\/DocWidgetComponent$/);
      const heading = page.getByRole("heading", {
        name: "DocWidgetComponent",
        level: 1,
      });
      await heading.waitFor({ state: "visible" });
      return { url: page.url(), filtered, heading: await heading.textContent() };
    });

    await test("docs search reaches every indexed symbol kind", async (page) => {
      const searchTable = docafBuilt!.snapshot.tables.search as {
        name: string;
        kind: string;
        summary?: string;
      }[];
      assert.equal(
        searchTable.length,
        expectedSearchEntries(docafBuilt!.snapshot),
        `docaf snapshot search table had ${searchTable.length} entries, expected ${expectedSearchEntries(
          docafBuilt!.snapshot
        )}`
      );
      const typedef = searchTable.find((entry) => entry.kind === "typedef");
      assert.ok(typedef, "docaf snapshot has no typedef search entries");
      const probes = [...INDEXED_SYMBOL_PROBES, [typedef!.name, "typedef"]];
      await page.goto(`${docafBuilt!.baseUrl}/`, {
        waitUntil: "networkidle",
      });
      const input = page.locator(".docs-search-input").first();
      await input.waitFor({ state: "visible" });
      const results = page.locator(".docs-search-results li");
      const observed: Record<string, string[]> = {};
      for (const [term, kind] of probes) {
        await input.fill(term);
        await page
          .locator(".docs-search-results li", { hasText: term })
          .first()
          .waitFor({ state: "visible", timeout: 5000 });
        const rendered = await results.allInnerTexts();
        assert.ok(
          rendered.some((text: string) => text.includes(term)),
          `${kind} probe "${term}" returned no matching result: ${rendered.join(
            " | "
          )}`
        );
        assert.equal(
          await page.locator(".docs-search-empty").count(),
          0,
          `${kind} probe "${term}" rendered "No matches"`
        );
        observed[term] = rendered;
      }
      return {
        indexedEntries: searchTable.length,
        typedef: typedef!.name,
        probes: Object.keys(observed),
      };
    });

    await test("docs search caps results per query", async (page) => {
      const searchTable = docafBuilt!.snapshot.tables.search as {
        name: string;
        summary?: string;
      }[];
      const broad = "a";
      const matching = searchTable.filter(
        (entry) =>
          entry.name.toLowerCase().includes(broad) ||
          (entry.summary ?? "").toLowerCase().includes(broad)
      ).length;
      assert.ok(
        matching > 20,
        `broad term "${broad}" only matched ${matching} snapshot entries`
      );
      await page.goto(`${docafBuilt!.baseUrl}/`, {
        waitUntil: "networkidle",
      });
      const input = page.locator(".docs-search-input").first();
      await input.waitFor({ state: "visible" });
      await input.fill(broad);
      const results = page.locator(".docs-search-results li");
      await results.first().waitFor({ state: "visible", timeout: 5000 });
      await page.waitForFunction(
        (term) => {
          const items = Array.from(
            document.querySelectorAll(".docs-search-results li")
          );
          return (
            items.length > 0 &&
            items.length <= 20 &&
            items.every((item) =>
              (item.textContent ?? "").toLowerCase().includes(term)
            )
          );
        },
        broad,
        { timeout: 5000 }
      );
      const rendered = await results.count();
      assert.ok(
        rendered > 0 && rendered <= 20,
        `broad term "${broad}" rendered ${rendered} results, expected 1..20 from ${matching} matches`
      );
      assert.equal(
        await page.locator(".docs-search-empty").count(),
        0,
        `broad term "${broad}" rendered "No matches"`
      );
      return { term: broad, matching, rendered };
    });

    await test("component preview controls update the component and events are observed", async (page) => {
      await page.goto(`${built!.baseUrl}${COMPONENT_ROUTE}`, {
        waitUntil: "networkidle",
      });
      const stage = page.locator(".docs-preview-stage").first();
      await stage.waitFor({ state: "visible" });
      const input = page
        .locator(".docs-preview-control", { hasText: "label" })
        .locator("input")
        .first();
      await input.fill("updated label");
      await page.waitForTimeout(200);
      const updated = await stage.innerText();
      assert.ok(
        updated.includes("updated label"),
        `preview stage did not update: ${updated}`
      );
      await page.locator(".docs-synthetic-preview button").first().click();
      const events = page.locator(".docs-preview-events").first();
      await events.waitFor({ state: "visible" });
      await page.waitForTimeout(200);
      const eventText = await events.innerText();
      assert.ok(
        eventText.includes("changed"),
        `preview events did not include changed: ${eventText}`
      );
      return { stage: updated, events: eventText };
    });

    await test("unknown preview fails gracefully inside the preview region", async (page) => {
      await page.goto(`${built!.baseUrl}${COMPONENT_ROUTE}`, {
        waitUntil: "networkidle",
      });
      await page.locator(".docs-preview").first().waitFor({ state: "visible" });
      const outcome = await page.evaluate(async () => {
        const host = document.querySelector("docs-preview");
        const ng = (globalThis as Record<string, any>).ng;
        if (!host || !ng) return { available: false };
        const component = ng.getComponent(host);
        component.value = {
          ...component.value,
          uid: "tests:unknown-preview",
          entry: "tests:unknown-preview",
          controls: [],
          events: [],
        };
        component.ngAfterViewInit();
        await new Promise((resolve) => setTimeout(resolve, 250));
        component.changeDetector.detectChanges();
        return {
          available: true,
          error: component.error ?? null,
          hasComponent: component.hasComponent,
          fallback:
            document.querySelector(".docs-preview-fallback")?.textContent ?? null,
          heading: document.querySelector("h1")?.textContent ?? null,
          sections: document.querySelectorAll(".docs-section").length,
        };
      });
      assert.equal(outcome.available, true, "Angular dev diagnostics unavailable");
      assert.equal(outcome.error, null, "unknown preview raised an error");
      assert.equal(outcome.hasComponent, false);
      assert.ok(
        (outcome.fallback ?? "").includes("No executable preview registered"),
        `fallback message missing: ${outcome.fallback}`
      );
      assert.equal(outcome.heading, "DocWidgetComponent");
      assert.ok(outcome.sections > 0, "page sections did not survive");
      return outcome;
    }, {
      // Mutating a checked component from the test harness makes Angular dev
      // mode report NG0100 for the view; it is not produced by the docs flow.
      allowConsoleErrors: [/NG0100/],
    });

    await test("broken preview fails gracefully inside the preview region", async (page) => {
      await page.goto(`${built!.baseUrl}${COMPONENT_ROUTE}`, {
        waitUntil: "networkidle",
      });
      await page.locator(".docs-preview").first().waitFor({ state: "visible" });
      const outcome = await page.evaluate(async () => {
        const host = document.querySelector("docs-preview");
        const ng = (globalThis as Record<string, any>).ng;
        if (!host || !ng) return { available: false };
        const component = ng.getComponent(host);
        component.runtime.registerPreview("tests:broken-preview", async () => {
          throw new Error("e2e boom");
        });
        component.value = {
          ...component.value,
          uid: "tests:broken-preview",
          entry: "tests:broken-preview",
        };
        component.ngAfterViewInit();
        await new Promise((resolve) => setTimeout(resolve, 250));
        return {
          available: true,
          error: component.error ?? null,
          hasComponent: component.hasComponent,
          previewError:
            document.querySelector(".docs-preview-error")?.textContent ?? null,
          heading: document.querySelector("h1")?.textContent ?? null,
          sections: document.querySelectorAll(".docs-section").length,
        };
      });
      assert.equal(outcome.available, true, "Angular dev diagnostics unavailable");
      assert.ok(
        (outcome.error ?? "").includes("e2e boom"),
        `component error missing: ${outcome.error}`
      );
      assert.equal(outcome.hasComponent, false);
      assert.ok(
        (outcome.previewError ?? "").includes("e2e boom"),
        `preview region did not surface the error: ${outcome.previewError}`
      );
      assert.equal(outcome.heading, "DocWidgetComponent");
      assert.ok(outcome.sections > 0, "page sections did not survive");
      return outcome;
    });

    await test("component page renders a dedicated docs-source block naming widget.component.ts", (page) =>
      assertDedicatedSourceBlock(
        page,
        `${built!.baseUrl}${COMPONENT_ROUTE}`,
        "widget.component.ts"
      )
    );

    await test("component page including preview has no serious or critical axe violations", async (page) => {
      await page.goto(`${built!.baseUrl}${COMPONENT_ROUTE}`, {
        waitUntil: "networkidle",
      });
      await page
        .getByRole("heading", { name: "DocWidgetComponent", level: 1 })
        .waitFor({ state: "visible" });
      const preview = page.locator(".docs-preview").first();
      await preview.waitFor({ state: "visible", timeout: 5000 });
      const { AxeBuilder } = axeModule();
      const analysis = await new AxeBuilder({ page }).analyze();
      const blocking = analysis.violations.filter(
        (violation: any) =>
          violation.impact === "serious" || violation.impact === "critical"
      );
      assert.equal(
        blocking.length,
        0,
        `axe found serious/critical violations on the component page: ${axeFailure(
          blocking
        )}`
      );
      return {
        url: page.url(),
        previewVisible: await preview.isVisible(),
        violationIds: analysis.violations.map((violation: any) => violation.id),
        seriousCritical: blocking.length,
      };
    });

    await test("native Angular preview updates the real component and emits events", async (page) => {
      await page.goto(`${nativeBuilt!.baseUrl}${COMPONENT_ROUTE}`, {
        waitUntil: "networkidle",
      });
      const marker = page.locator(".native-widget-marker").first();
      await marker.waitFor({ state: "visible" });
      const stage = page.locator(".docs-preview-stage").first();
      const input = page
        .locator(".docs-preview-control", { hasText: "label" })
        .locator("input")
        .first();
      await input.fill("native updated");
      await page.waitForTimeout(200);
      const stageText = await stage.innerText();
      assert.ok(
        stageText.includes("native updated"),
        `native preview did not update: ${stageText}`
      );
      await page.locator(".native-widget button").first().click();
      const events = page.locator(".docs-preview-events").first();
      await events.waitFor({ state: "visible" });
      await page.waitForTimeout(200);
      const eventText = await events.innerText();
      assert.ok(
        eventText.includes("changed"),
        `native preview events did not include changed: ${eventText}`
      );
      return {
        marker: await marker.textContent(),
        stage: stageText,
        events: eventText,
      };
    });
  } finally {
    if (browser) await browser.close();
    for (const app of apps.reverse()) await app.close();
  }

  const failed = results.filter((result) => !result.ok);
  const summary = {
    url: built!.baseUrl,
    overflowRegressionUrl: overflowBuilt!.baseUrl,
    nativePreviewUrl: nativeBuilt!.baseUrl,
    docafDocsUrl: docafBuilt!.baseUrl,
    fileModeUrl: pathToFileURL(
      path.join(fileBuilt!.output, "index.html")
    ).href,
    buildOutputs: [
      built.output,
      overflowBuilt.output,
      nativeBuilt.output,
      fileBuilt.output,
      docafBuilt.output,
    ],
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  await fs.writeFile(
    path.join(ARTIFACTS, "e2e-results.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  log.info(JSON.stringify(summary, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  log.error(error);
  process.exitCode = 1;
});
