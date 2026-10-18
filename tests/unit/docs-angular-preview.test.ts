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
      if (this.registry.has(name)) {
        throw new Error(`Component "${name}" is already registered`);
      }
      this.registry.set(name, constructor);
    }
  }
  return { LayoutComponent, NgxRenderingEngine };
});

import { DocsPreviewComponent } from "../../src/for-angular/rendering/DocsAngularComponents";
import type {
  DocsPreviewControlEntry,
  DocsPreviewEntry,
} from "../../src/ui";

interface FakeEmitter {
  subscribe: jest.Mock;
  emit: jest.Mock;
}

interface FakeRef {
  instance: Record<string, FakeEmitter>;
  setInput: jest.Mock;
  destroy: jest.Mock;
}

interface Harness {
  component: DocsPreviewComponent;
  runtime: {
    previewLoader: jest.Mock;
    registerPreview: jest.Mock;
  };
  changeDetector: { detectChanges: jest.Mock };
  viewContainer: { createComponent: jest.Mock };
  ref: FakeRef;
  inputs: Record<string, unknown>;
  listeners: ((event: unknown) => void)[];
  subscription: { unsubscribe: jest.Mock };
}

function previewEntry(
  overrides: Partial<DocsPreviewEntry> = {}
): DocsPreviewEntry {
  return {
    uid: "preview:widget",
    title: "DocWidgetComponent preview",
    framework: "angular",
    entry: "component:widget",
    kind: "native",
    initialProps: { label: "hello" },
    controls: [
      {
        name: "count",
        alias: "itemCount",
        kind: "input",
        typeText: "number",
        required: true,
        value: 3,
      },
      {
        name: "label",
        kind: "input",
        typeText: "string",
        optional: true,
        value: "hello",
      },
    ],
    events: ["changed"],
    ...overrides,
  };
}

function harness(loader: (() => Promise<unknown>) | undefined): Harness {
  const inputs: Record<string, unknown> = {};
  const listeners: ((event: unknown) => void)[] = [];
  const subscription = { unsubscribe: jest.fn() };
  const emitter: FakeEmitter = {
    subscribe: jest.fn((listener: (event: unknown) => void) => {
      listeners.push(listener);
      return subscription;
    }),
    emit: jest.fn(),
  };
  const ref: FakeRef = {
    instance: { changed: emitter },
    setInput: jest.fn((name: string, value: unknown) => {
      inputs[name] = value;
    }),
    destroy: jest.fn(),
  };
  const runtime = {
    previewLoader: jest.fn((key: string | undefined) =>
      key === "component:widget" ? loader : undefined
    ),
    registerPreview: jest.fn(),
  };
  const changeDetector = { detectChanges: jest.fn() };
  const viewContainer = {
    createComponent: jest.fn(() => ref),
  };
  const component = new DocsPreviewComponent(
    runtime as never,
    changeDetector as never
  );
  component.previewHost = viewContainer as never;
  return {
    component,
    runtime,
    changeDetector,
    viewContainer,
    ref,
    inputs,
    listeners,
    subscription,
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("DocsPreviewComponent native Angular preview", () => {
  it("loads the component and applies model-driven input controls", async () => {
    const FakeComponent = class FakePreview {};
    const test = harness(async () => FakeComponent);
    test.component.value = previewEntry();

    test.component.ngAfterViewInit();
    await flush();

    expect(test.component.hasComponent).toBe(true);
    expect(test.component.error).toBeUndefined();
    expect(test.viewContainer.createComponent).toHaveBeenCalledWith(
      FakeComponent
    );
    expect(test.inputs).toMatchObject({ itemCount: 3, label: "hello" });
    expect(test.changeDetector.detectChanges).toHaveBeenCalled();
  });

  it("updates the rendered component when a control changes", async () => {
    const test = harness(async () => class FakePreview {});
    const entry = previewEntry();
    test.component.value = entry;
    test.component.ngAfterViewInit();
    await flush();
    test.ref.setInput.mockClear();

    const label = entry.controls.find(
      (control) => control.name === "label"
    ) as DocsPreviewControlEntry;
    test.component.setControl(label, "updated label");

    expect(test.ref.setInput).toHaveBeenCalledWith("label", "updated label");
    expect(label.value).toBe("updated label");
    expect(test.changeDetector.detectChanges).toHaveBeenCalled();
    expect(test.component.error).toBeUndefined();
  });

  it("observes component output events", async () => {
    const test = harness(async () => class FakePreview {});
    test.component.value = previewEntry();
    test.component.ngAfterViewInit();
    await flush();

    expect(test.listeners).toHaveLength(1);
    test.listeners[0]({ value: "updated label" });

    expect(test.component.events).toEqual([
      { name: "changed", value: { value: "updated label" } },
    ]);
  });

  it("fails gracefully when the preview loader throws", async () => {
    const test = harness(async () => {
      throw new Error("boom");
    });
    test.component.value = previewEntry();

    test.component.ngAfterViewInit();
    await flush();

    expect(test.component.hasComponent).toBe(false);
    expect(test.component.error).toContain("Preview failed to load: boom");
    expect(test.viewContainer.createComponent).not.toHaveBeenCalled();
  });

  it("fails gracefully when no preview loader is registered", async () => {
    const test = harness(undefined);
    test.component.value = previewEntry({
      entry: "component:missing",
      uid: "preview:missing",
    });

    test.component.ngAfterViewInit();
    await flush();

    expect(test.component.hasComponent).toBe(false);
    expect(test.component.error).toBeUndefined();
    expect(test.runtime.previewLoader).toHaveBeenCalledWith("component:missing");
    expect(test.viewContainer.createComponent).not.toHaveBeenCalled();
  });

  it("tears down outputs and the component instance on destroy", async () => {
    const test = harness(async () => class FakePreview {});
    test.component.value = previewEntry();
    test.component.ngAfterViewInit();
    await flush();

    test.component.ngOnDestroy();

    expect(test.subscription.unsubscribe).toHaveBeenCalled();
    expect(test.ref.destroy).toHaveBeenCalled();
  });

  it("reports an unsupported control update without throwing", async () => {
    const test = harness(async () => class FakePreview {});
    test.component.value = previewEntry();
    test.component.ngAfterViewInit();
    await flush();
    test.ref.setInput.mockImplementation(() => {
      throw new Error("No input named mystery");
    });

    const control: DocsPreviewControlEntry = {
      name: "mystery",
      kind: "input",
    };
    test.component.setControl(control, "value");

    expect(test.component.error).toContain('Failed to update "mystery"');
  });
});
