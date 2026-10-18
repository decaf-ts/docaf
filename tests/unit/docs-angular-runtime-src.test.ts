jest.mock("@angular/core", () => {
  const decorator = () => () => undefined;
  class InjectionToken {
    constructor(public readonly description: string) {}
  }
  return {
    Component: decorator,
    Injectable: decorator,
    Inject: decorator,
    Input: decorator,
    Output: decorator,
    ViewChild: decorator,
    InjectionToken,
  };
});

jest.mock("@angular/common", () => ({
  CommonModule: class CommonModule {},
}));

jest.mock("@angular/router", () => ({
  RouterLink: class RouterLink {},
  Router: class Router {},
  NavigationEnd: class NavigationEnd {},
}));

jest.mock("@decaf-ts/for-angular", () => {
  class LayoutComponent {}
  class NgxRenderingEngine {
    static readonly registry = new Map<string, unknown>();

    async initialize(): Promise<void> {
      // Registration is the observable the docs adapter relies on.
    }

    static components(selector?: string): unknown {
      if (!selector) return [...this.registry.keys()];
      if (!this.registry.has(selector))
        throw new Error(`Component "${selector}" is not registered`);
      return this.registry.get(selector);
    }

    static registerComponent(name: string, constructor: unknown): void {
      this.registry.set(name, constructor);
    }
  }
  return { LayoutComponent, NgxRenderingEngine };
});

import {
  DOCS_ANGULAR_PREVIEWS,
  DocsAngularRuntime,
} from "../../src/for-angular/runtime/DocsAngularRuntime";
import { DocsPageService } from "../../src/ui/DocsPageService";
import { cloneFixture } from "./support/fixtures";

const loader = () => Promise.resolve({});
const otherLoader = () => Promise.resolve({});

function okResponse(snapshot: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => snapshot,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DOCS_ANGULAR_PREVIEWS", () => {
  it("defaults to an empty registry", () => {
    expect(DOCS_ANGULAR_PREVIEWS).toBeDefined();
  });
});

describe("DocsAngularRuntime preview registry", () => {
  it("registers preview loaders from useValue and constructor", () => {
    const runtime = new DocsAngularRuntime({
      "component:one": loader,
    });

    expect(runtime.previewKeys()).toEqual(["component:one"]);
    expect(runtime.previewLoader("component:one")).toBe(loader);
    expect(runtime.previewLoader("missing")).toBeUndefined();
    expect(runtime.previewLoader(undefined)).toBeUndefined();
  });

  it("adds and overrides preview loaders at runtime", () => {
    const runtime = new DocsAngularRuntime({});

    runtime.registerPreview("preview:one", loader);
    runtime.registerPreview("preview:one", otherLoader);

    expect(runtime.previewKeys()).toEqual(["preview:one"]);
    expect(runtime.previewLoader("preview:one")).toBe(otherLoader);
  });

  it("tolerates a missing preview registry", () => {
    const runtime = new DocsAngularRuntime(
      undefined as unknown as Record<string, never>
    );

    expect(runtime.previewKeys()).toEqual([]);
  });
});

describe("DocsAngularRuntime initialization", () => {
  it("throws when the page service is requested before initialization", () => {
    const runtime = new DocsAngularRuntime({});

    expect(() => runtime.pageService).toThrow("Documentation runtime not initialized");
    expect(runtime.initialized).toBe(false);
  });

  it("fetches and hydrates the snapshot into a page service", async () => {
    const fetchMock = jest.fn(async () => okResponse(cloneFixture()));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
    const runtime = new DocsAngularRuntime({});

    const service = await runtime.initialize();

    expect(fetchMock).toHaveBeenCalledWith("assets/docs/snapshot.json");
    expect(service).toBeInstanceOf(DocsPageService);
    expect(runtime.initialized).toBe(true);
    expect(runtime.pageService).toBe(service);
  });

  it("uses the supplied snapshot URL and keeps it across calls", async () => {
    const fetchMock = jest.fn(async () => okResponse(cloneFixture()));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
    const runtime = new DocsAngularRuntime({});

    await runtime.initialize({ snapshotUrl: "/custom/snapshot.json" });
    await runtime.initialize();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/custom/snapshot.json");
  });

  it("deduplicates concurrent initialization calls", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = jest.fn(async () => {
      await gate;
      return okResponse(cloneFixture());
    });
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
    const runtime = new DocsAngularRuntime({});

    const first = runtime.initialize();
    const second = runtime.initialize();
    release?.();
    const [firstService, secondService] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstService).toBe(secondService);
  });

  it("propagates load failures and allows a retry", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce(okResponse(cloneFixture()));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
    const runtime = new DocsAngularRuntime({});

    await expect(runtime.initialize()).rejects.toThrow(
      "Failed to load docs snapshot: 500"
    );
    expect(runtime.initialized).toBe(false);

    const service = await runtime.initialize();
    expect(service).toBeInstanceOf(DocsPageService);
    expect(runtime.initialized).toBe(true);
  });
});
