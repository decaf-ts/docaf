import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DocsDatabase } from "../../lib/esm/database/index.js";
import { DocumentationCompiler } from "../../lib/esm/generator/compiler/DocumentationCompiler.js";
import { AngularDocsBuildTarget } from "../../lib/esm/build/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECT = { name: "@fixture/adapter", version: "1.0.0" };
const SLICE = path.join(ROOT, "tests/fixtures/vertical-slice/src");
const NATIVE_PREVIEW = path.join(ROOT, "tests/fixtures/native-preview/src");
const ARTIFACTS = path.join(ROOT, "tmp/e2e-artifacts");
const CLASS_ROUTE = "/#/docs/classes/RamAdapter";
const COMPONENT_ROUTE = "/#/docs/components/DocWidgetComponent";

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
  sourceDirectory: string
): Promise<{ baseUrl: string; output: string; close: () => Promise<void> }> {
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
    config: { project: { name: PROJECT.name }, output: { baseHref: "/" } },
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
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  };
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

async function main(): Promise<void> {
  await fs.mkdir(ARTIFACTS, { recursive: true });
  const apps: { close: () => Promise<void> }[] = [];
  let browser: any;
  let built: { baseUrl: string; output: string } | undefined;
  let nativeBuilt: { baseUrl: string; output: string } | undefined;
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
    process.stderr.write("building native-preview docs app\n");
    nativeBuilt = await buildApp("native-preview", NATIVE_PREVIEW);
    apps.push(nativeBuilt);
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

    await test("class page renders a visible Source section naming adapter.ts", async (page) => {
      await page.goto(`${built!.baseUrl}${CLASS_ROUTE}`, {
        waitUntil: "networkidle",
      });
      const source = page
        .locator(".docs-section")
        .filter({
          has: page.getByRole("heading", { name: "Source", exact: true }),
        })
        .first();
      await source.waitFor({ state: "visible", timeout: 5000 });
      const text = (await source.innerText()).trim();
      assert.ok(
        text.includes("adapter.ts"),
        `Source section did not identify adapter.ts; observed: ${JSON.stringify(text)}`
      );
      return { source: text };
    });

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

    await test("component page renders a visible Source section naming widget.component.ts", async (page) => {
      await page.goto(`${built!.baseUrl}${COMPONENT_ROUTE}`, {
        waitUntil: "networkidle",
      });
      const source = page
        .locator(".docs-section")
        .filter({
          has: page.getByRole("heading", { name: "Source", exact: true }),
        })
        .first();
      await source.waitFor({ state: "visible", timeout: 5000 });
      const text = (await source.innerText()).trim();
      assert.ok(
        text.includes("widget.component.ts"),
        `Source section did not identify widget.component.ts; observed: ${JSON.stringify(
          text
        )}`
      );
      return { source: text };
    });

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
    nativePreviewUrl: nativeBuilt!.baseUrl,
    buildOutputs: [built.output, nativeBuilt.output],
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  await fs.writeFile(
    path.join(ARTIFACTS, "e2e-results.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
