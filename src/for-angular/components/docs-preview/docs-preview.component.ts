import { CommonModule } from "@angular/common";
import { ChangeDetectorRef } from "@angular/core";
import { Component } from "@angular/core";
import { ComponentRef } from "@angular/core";
import { SimpleChanges } from "@angular/core";
import { Type } from "@angular/core";
import { ViewChild } from "@angular/core";
import { ViewContainerRef } from "@angular/core";
import { DocsPreviewControlEntry } from "../../../ui/views/DocsViews";
import { DocsPreviewEntry } from "../../../ui/views/DocsViews";
import { Injector } from "@angular/core";
import { DocsAngularRuntime } from "../../runtime/DocsAngularRuntime";
import { DocsBlockBase } from "../docs-block-base";
import { fieldValue } from "../docs-shared";

/**
 * @description Renders a live, interactive preview of a documented component.
 * @summary Native target of the "docs.preview" element. Loads the preview
 * component through the {@link DocsAngularRuntime} preview loader, instantiates
 * it in a view container with the preview's initial props, binds per-input
 * controls (updating inputs live via `setInput`), collects emitted outputs into
 * an event log, and tears everything down on destroy or input change. Renders
 * an error placeholder when the preview cannot be loaded.
 * @component DocsPreviewComponent
 * @example
 * <docs-preview [value]="previewEntry"></docs-preview>
 * @category Components
 */
@Component({
  selector: "docs-preview",
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: "./docs-preview.component.html",
  styleUrl: "./docs-preview.component.css",
})
export class DocsPreviewComponent extends DocsBlockBase {

  @ViewChild("previewHost", { read: ViewContainerRef })
  previewHost?: ViewContainerRef;

  error?: string;
  hasComponent = false;
  events: { name: string; value: unknown }[] = [];

  /**
   * @description Root docs runtime used to resolve preview loaders and to
   * register previews from the page at runtime.
   */
  readonly runtime: DocsAngularRuntime;

  private componentRef?: ComponentRef<Record<string, unknown>>;
  private subscriptions: (() => void)[] = [];

  constructor(
    injector: Injector,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    super();
    this.runtime = injector.get(DocsAngularRuntime);
  }

  get preview(): DocsPreviewEntry | undefined {
    if (this.isPreviewEntry(this.value)) return this.value;
    for (const block of this.blocks) {
      const candidate = fieldValue(block);
      if (this.isPreviewEntry(candidate)) return candidate;
    }
    return undefined;
  }

  private isPreviewEntry(value: unknown): value is DocsPreviewEntry {
    if (!value || typeof value !== "object") return false;
    return typeof (value as Partial<DocsPreviewEntry>).entry === "string";
  }

  asBoolean(value: unknown): boolean {
    return Boolean(value);
  }

  asString(value: unknown): string {
    return value === undefined || value === null ? "" : String(value);
  }

  isNumber(control: DocsPreviewControlEntry): boolean {
    return control.typeText === "number" || typeof control.value === "number";
  }

  setControl(control: DocsPreviewControlEntry, value: unknown): void {
    control.value = value;
    this.applyInput(control.alias ?? control.name, value);
  }

  ngAfterViewInit(): void {
    void this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["value"] && !changes["value"].firstChange) {
      void this.load();
    }
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  private async load(): Promise<void> {
    this.teardown();
    this.error = undefined;
    this.hasComponent = false;
    const preview = this.preview;
    if (!preview) return;
    try {
      const runtime = this.runtime;
      const loader =
        runtime.previewLoader(preview.entry) ??
        runtime.previewLoader(preview.uid);
      if (!loader) return;
      const component = (await loader()) as Type<Record<string, unknown>>;
      if (!this.previewHost) return;
      const ref = this.previewHost.createComponent(component);
      this.componentRef = ref;
      this.hasComponent = true;
      const inputs: Record<string, unknown> = {
        ...preview.initialProps,
        ...Object.fromEntries(
          (preview.controls ?? [])
            .filter((control) => control.value !== undefined)
            .map((control) => [control.alias ?? control.name, control.value])
        ),
      };
      for (const [name, value] of Object.entries(inputs)) {
        try {
          ref.setInput(name, value);
        } catch {
          // Unsupported inputs keep the component defaults.
        }
      }
      this.subscribeOutputs(ref);
      this.changeDetector.detectChanges();
    } catch (error) {
      this.error = "Preview failed to load: " + ((error as Error).message ?? error);
      this.changeDetector.detectChanges();
    }
  }

  private subscribeOutputs(ref: ComponentRef<Record<string, unknown>>): void {
    const instance = ref.instance as Record<string, unknown>;
    for (const [name, value] of Object.entries(instance)) {
      const emitter = value as {
        subscribe?: (listener: (event: unknown) => void) => { unsubscribe(): void };
        emit?: (...args: unknown[]) => void;
      };
      if (
        !emitter ||
        typeof emitter.subscribe !== "function" ||
        typeof emitter.emit !== "function"
      )
        continue;
      const subscription = emitter.subscribe((event) => {
        this.events = [...this.events, { name, value: event }];
        this.changeDetector.detectChanges();
      });
      this.subscriptions.push(() => subscription.unsubscribe());
    }
  }

  private applyInput(name: string, value: unknown): void {
    if (!this.componentRef) return;
    try {
      this.componentRef.setInput(name, value);
      this.changeDetector.detectChanges();
    } catch (error) {
      this.error = 'Failed to update "' + name + '": ' + ((error as Error).message ?? error);
    }
  }

  private teardown(): void {
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions = [];
    this.componentRef?.destroy();
    this.componentRef = undefined;
  }

}
