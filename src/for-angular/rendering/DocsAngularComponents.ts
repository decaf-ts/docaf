import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  Type,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import type {
  DocsComponentViewEntry,
  DocsExampleEntry,
  DocsMemberEntry,
  DocsNavigationEntry,
  DocsPreviewControlEntry,
  DocsPreviewEntry,
  DocsSectionEntry,
  DocsSourceViewEntry,
} from "../../ui/views/DocsViews";
import { DocsAngularRuntime } from "../runtime/DocsAngularRuntime";

function display(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * @description Primitive docs component rendering text or headings for a given heading level.
 * @summary Standalone component (`docs-text`) mapped to the docs text semantic tags. Renders
 * `value` inside an h1-h4 element when `level` is 1-4, otherwise as a plain span. Other inputs
 * (name, type) are accepted for uniformity with the renderer contract but do not affect output.
 * @class DocsTextComponent
 */
@Component({
  selector: "docs-text",
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (level) {
      @case (1) {
        <h1 class="docs-heading">{{ display(value) }}</h1>
      }
      @case (3) {
        <h3 class="docs-heading">{{ display(value) }}</h3>
      }
      @case (4) {
        <h4 class="docs-heading">{{ display(value) }}</h4>
      }
      @case (2) {
        <h2 class="docs-heading">{{ display(value) }}</h2>
      }
      @default {
        <span class="docs-text">{{ display(value) }}</span>
      }
    }
  `,
})
export class DocsTextComponent {
  @Input() value: unknown;
  @Input() name?: string;
  @Input() type?: string;
  @Input() level?: number | string;

  display = display;
}

/**
 * @description Primitive docs component rendering the documentation site brand link.
 * @summary Standalone component (`docs-brand`) that renders `value` as the brand name inside an
 * anchor navigating to `route`, defaulting to the site root `/`.
 * @class DocsBrandComponent
 */
@Component({
  selector: "docs-brand",
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="docs-brand" [routerLink]="route || '/'">
      <span class="docs-brand-name">{{ display(value) }}</span>
    </a>
  `,
})
export class DocsBrandComponent {
  @Input() value: unknown;
  @Input() route?: string;
  display = display;
}

/**
 * @description Primitive docs component rendering internal or external documentation links.
 * @summary Standalone component (`docs-link`). `value` may be a plain label string or an object
 * with label/route/anchor/href; inputs `route` and `anchor` act as fallbacks for object values.
 * Renders a router link for internal routes, a plain anchor for external hrefs, and a span when
 * neither is available.
 * @class DocsLinkComponent
 */
@Component({
  selector: "docs-link",
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (target.route) {
      <a [routerLink]="target.route" [fragment]="target.anchor">
        {{ target.label }}
      </a>
    } @else if (target.href) {
      <a [attr.href]="target.href">{{ target.label }}</a>
    } @else {
      <span>{{ target.label }}</span>
    }
  `,
})
export class DocsLinkComponent {
  @Input() value: unknown;
  @Input() route?: string;
  @Input() anchor?: string;

  get target(): { label: string; route?: string; anchor?: string; href?: string } {
    if (typeof this.value === "string")
      return { label: this.value, route: this.route, anchor: this.anchor };
    const value = (this.value ?? {}) as Record<string, unknown>;
    return {
      label:
        (value.label as string) ??
        (value.name as string) ??
        (value.route as string) ??
        "",
      route: (value.route as string) ?? this.route,
      anchor: (value.anchor as string) ?? this.anchor,
      href: (value.href as string) ?? undefined,
    };
  }
}

/**
 * @description Recursive primitive component rendering nested navigation entries.
 * @summary Standalone component (`docs-nav-children`) that renders a nested unordered list of
 * {@link DocsNavigationEntry} items: entries with a route become router links (with anchor
 * fragments), others are rendered as group headings, and children recurse into nested lists.
 * @class DocsNavChildrenComponent
 */
@Component({
  selector: "docs-nav-children",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <ul class="docs-nav docs-nav-nested">
      @for (item of items; track item.uid) {
        <li class="docs-nav-item">
          @if (item.route) {
            <a [routerLink]="item.route" [fragment]="item.anchor">{{
              item.label
            }}</a>
          } @else {
            <span class="docs-nav-group">{{ item.label }}</span>
          }
          @if (item.children?.length) {
            <docs-nav-children [items]="item.children ?? []" />
          }
        </li>
      }
    </ul>
  `,
})
export class DocsNavChildrenComponent {
  @Input() items: DocsNavigationEntry[] = [];
}

/**
 * @description Primitive docs component rendering the docs list views (sections, navigation, toc,
 * breadcrumbs, members, examples, related).
 * @summary Standalone component (`docs-list`) mapped to the docs list semantic tags. It infers
 * the render mode from the component's `name` input and the shape of the first `value` item
 * (e.g. sections by "key", navigation by "label"+"route", members by "signature", search entries
 * by "longname", source entries by name "source"), then renders the corresponding markup with
 * router links and fragment anchors where applicable. Unknown or empty values render an empty
 * state or a plain text fallback.
 * @class DocsListComponent
 */
@Component({
  selector: "docs-list",
  standalone: true,
  imports: [CommonModule, RouterLink, DocsNavChildrenComponent],
  template: `
    @switch (mode) {
      @case ("sections") {
        <div class="docs-sections">
          @for (section of sections; track section.uid) {
            <section class="docs-section" [attr.id]="'section-' + section.key">
              @if (section.title) {
                <h2>{{ section.title }}</h2>
              }
              @if (section.content) {
                <p class="docs-section-content">{{ section.content }}</p>
              }
              @if (section.members?.length) {
                <ul class="docs-member-list">
                  @for (member of section.members; track member.uid) {
                    <li class="docs-member" [attr.id]="member.anchor">
                      <span class="docs-member-name">{{ member.name }}</span>
                      @if (member.signature) {
                        <code class="docs-member-signature">{{
                          member.signature
                        }}</code>
                      }
                      @if (member.description) {
                        <p class="docs-member-description">
                          {{ member.description }}
                        </p>
                      }
                    </li>
                  }
                </ul>
              }
              @if (section.examples?.length) {
                <div class="docs-examples">
                  @for (example of section.examples; track example.uid) {
                    @if (example.caption) {
                      <p class="docs-example-caption">{{ example.caption }}</p>
                    }
                    <pre class="docs-code"><code>{{ example.code }}</code></pre>
                  }
                </div>
              }
              @if (section.code) {
                <pre class="docs-code"><code>{{ section.code }}</code></pre>
              }
            </section>
          }
        </div>
      }
      @case ("navigation") {
        <ul class="docs-nav">
          @for (item of navigation; track item.uid) {
            <li class="docs-nav-item">
              @if (item.route) {
                <a [routerLink]="item.route" [fragment]="item.anchor">{{
                  item.label
                }}</a>
              } @else {
                <span class="docs-nav-group">{{ item.label }}</span>
              }
              @if (item.children?.length) {
                <docs-nav-children [items]="item.children ?? []" />
              }
            </li>
          }
        </ul>
      }
      @case ("toc") {
        <ul class="docs-toc">
          @for (item of toc; track $index) {
            <li>
              @if (item.anchor) {
                <a [routerLink]="currentRoute || '/'" [fragment]="item.anchor">{{
                  item.label
                }}</a>
              } @else {
                <span>{{ item.label }}</span>
              }
            </li>
          }
        </ul>
      }
      @case ("breadcrumbs") {
        <nav class="docs-breadcrumbs" aria-label="Breadcrumb">
          @for (item of breadcrumbs; track $index) {
            @if (item.route) {
              <a [routerLink]="item.route">{{ item.label }}</a>
            } @else {
              <span aria-current="page">{{ item.label }}</span>
            }
            @if (!$last) {
              <span class="docs-breadcrumb-separator">/</span>
            }
          }
        </nav>
      }
      @case ("members") {
        <ul class="docs-member-list">
          @for (member of members; track member.uid) {
            <li class="docs-member" [attr.id]="member.anchor">
              <span class="docs-member-name">{{ member.name }}</span>
              @if (member.kind) {
                <span class="docs-member-kind">{{ member.kind }}</span>
              }
              @if (member.signature) {
                <code class="docs-member-signature">{{ member.signature }}</code>
              }
              @if (member.description) {
                <p class="docs-member-description">{{ member.description }}</p>
              }
            </li>
          }
        </ul>
      }
      @case ("examples") {
        <div class="docs-examples">
          @for (example of examples; track example.uid) {
            @if (example.caption) {
              <p class="docs-example-caption">{{ example.caption }}</p>
            }
            <pre class="docs-code"><code>{{ example.code }}</code></pre>
          }
        </div>
      }
      @case ("related") {
        <ul class="docs-related">
          @for (item of navigation; track item.uid) {
            <li>
              @if (item.route) {
                <a [routerLink]="item.route">{{ item.label }}</a>
              } @else {
                <span>{{ item.label }}</span>
              }
            </li>
          }
        </ul>
      }
      @default {
        @if (!isEmpty) {
          <p class="docs-empty">{{ display(value) }}</p>
        }
      }
    }
  `,
})
export class DocsListComponent {
  @Input() value: unknown;
  @Input() name?: string;
  @Input() type?: string;

  display = display;

  get isEmpty(): boolean {
    return Array.isArray(this.value) && this.value.length === 0;
  }

  get items(): Record<string, unknown>[] {
    return Array.isArray(this.value)
      ? (this.value as Record<string, unknown>[])
      : [];
  }

  get mode(): string {
    if (this.name === "entries") return "search";
    const first = this.items[0];
    if (!first) return "empty";
    if (this.name === "source") return "source";
    if ("longname" in first) return "search";
    if ("key" in first) return "sections";
    if ("code" in first) return "examples";
    if ("label" in first) {
      if ("children" in first || "kind" in first || "route" in first)
        return this.name === "related" ? "related" : "navigation";
      if ("level" in first || "anchor" in first) return "toc";
      return "breadcrumbs";
    }
    if ("signature" in first || ("kind" in first && "name" in first))
      return "members";
    return "empty";
  }

  get currentRoute(): string {
    return typeof window === "undefined"
      ? ""
      : window.location.hash.replace(/^#/, "");
  }

  get sections(): DocsSectionEntry[] {
    return this.items as unknown as DocsSectionEntry[];
  }

  get navigation(): DocsNavigationEntry[] {
    return this.items as unknown as DocsNavigationEntry[];
  }

  get breadcrumbs(): { label: string; route?: string }[] {
    return this.items as unknown as { label: string; route?: string }[];
  }

  get toc(): { label: string; anchor?: string }[] {
    return this.items as unknown as { label: string; anchor?: string }[];
  }

  get members(): DocsMemberEntry[] {
    return this.items as unknown as DocsMemberEntry[];
  }

  get examples(): DocsExampleEntry[] {
    return this.items as unknown as DocsExampleEntry[];
  }
}

/**
 * @description Primitive docs component providing client-side search over documentation entries.
 * @summary Standalone component (`docs-search`) that renders a search input filtering the
 * `value` array of entries by name or summary (case-insensitive), listing at most 20 results as
 * router links with kind labels and summaries. Results are cleared when the term is empty.
 * @class DocsSearchComponent
 */
@Component({
  selector: "docs-search",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="docs-search">
      <input
        class="docs-search-input"
        type="search"
        placeholder="Search documentation"
        aria-label="Search documentation"
        (input)="term = $any($event.target).value"
      />
      <ul class="docs-search-results">
        @for (entry of results; track entry.uid) {
          <li>
            @if (entry.route) {
              <a [routerLink]="entry.route" [fragment]="entry.anchor">{{
                entry.name
              }}</a>
            } @else {
              <span>{{ entry.name }}</span>
            }
            <span class="docs-search-kind">{{ entry.kind }}</span>
            @if (entry.summary) {
              <p class="docs-search-summary">{{ entry.summary }}</p>
            }
          </li>
        }
      </ul>
    </div>
  `,
})
export class DocsSearchComponent {
  @Input() value: unknown;
  term = "";

  get entries(): {
    uid: string;
    name: string;
    kind: string;
    summary?: string;
    route?: string;
    anchor?: string;
  }[] {
    return Array.isArray(this.value)
      ? (this.value as {
          uid: string;
          name: string;
          kind: string;
          summary?: string;
          route?: string;
          anchor?: string;
        }[])
      : [];
  }

  get results() {
    const term = this.term.trim().toLowerCase();
    if (!term) return [];
    return this.entries
      .filter(
        (entry) =>
          entry.name.toLowerCase().includes(term) ||
          (entry.summary ?? "").toLowerCase().includes(term)
      )
      .slice(0, 20);
  }
}

/**
 * @description Primitive docs component rendering a source file reference for a documented symbol.
 * @summary Standalone component (`docs-source`) that displays the file name with optional
 * line/column from the {@link DocsSourceViewEntry} input, plus an optional repository link.
 * Falls back to a `fileName: "unknown"` entry when no value is set.
 * @class DocsSourceComponent
 */
@Component({
  selector: "docs-source",
  standalone: true,
  template: `
    <div class="docs-source">
      <p class="docs-source-file">
        {{ source.fileName }}
        @if (source.line) {
          <span>:{{ source.line }}</span>
        }
        @if (source.column) {
          <span>:{{ source.column }}</span>
        }
      </p>
      @if (source.repository) {
        <p class="docs-source-repository">{{ source.repository }}</p>
      }
    </div>
  `,
})
export class DocsSourceComponent {
  @Input() value?: DocsSourceViewEntry;
  get source(): DocsSourceViewEntry {
    return this.value ?? { fileName: "unknown" };
  }
}

/**
 * @description Primitive docs component rendering tutorial content.
 * @summary Standalone component (`docs-tutorial`) that renders the markdown `value` inside an
 * article element styled as a docs markdown block.
 * @class DocsTutorialComponent
 */
@Component({
  selector: "docs-tutorial",
  standalone: true,
  template: `
    <article class="docs-tutorial">
      <pre class="docs-markdown">{{ value }}</pre>
    </article>
  `,
})
export class DocsTutorialComponent {
  @Input() value?: string;
}

/**
 * @description Primitive docs component rendering documented component metadata.
 * @summary Standalone component (`docs-component-metadata`) that shows the selector, an inputs
 * table (name with alias, type, default, description), and an outputs list (event name with
 * payload type) from the {@link DocsComponentViewEntry} input. Renders nothing without a value.
 * @class DocsComponentMetadataComponent
 */
@Component({
  selector: "docs-component-metadata",
  standalone: true,
  template: `
    @if (component) {
      <div class="docs-component-metadata">
        @if (component.selector) {
          <p>
            <strong>Selector:</strong>
            <code>{{ component.selector }}</code>
          </p>
        }
        @if (component.properties.length) {
          <h3>Inputs</h3>
          <table class="docs-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Default</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              @for (property of component.properties; track property.name) {
                <tr>
                  <td>
                    {{ property.name }}
                    @if (property.alias) {
                      <span class="docs-alias">({{ property.alias }})</span>
                    }
                  </td>
                  <td>{{ property.typeText }}</td>
                  <td>{{ property.defaultValue }}</td>
                  <td>{{ property.description }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
        @if (component.events.length) {
          <h3>Outputs</h3>
          <ul>
            @for (event of component.events; track event.name) {
              <li>
                <code>{{ event.name }}</code>
                @if (event.payloadTypeText) {
                  <span>: {{ event.payloadTypeText }}</span>
                }
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class DocsComponentMetadataComponent {
  @Input() value?: DocsComponentViewEntry;
  get component(): DocsComponentViewEntry | undefined {
    return this.value;
  }
}

/**
 * @description Interactive primitive component rendering executable component previews.
 * @summary Standalone component (`docs-preview`) that resolves a loader for the preview entry or
 * UID from the {@link DocsAngularRuntime} registry, dynamically creates the loaded component in
 * a view container, applies initial props and live control values as component inputs, and
 * records emitted outputs in an events log. Control inputs are rendered as checkbox, number, or
 * text fields based on the documented type. Renders a fallback message when no executable
 * component is registered, and an error message when loading fails. The instantiated component
 * and its output subscriptions are torn down on value change or destroy.
 * @class DocsPreviewComponent
 */
@Component({
  selector: "docs-preview",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="docs-preview">
      <header class="docs-preview-header">
        <h2>{{ preview?.title ?? "Preview" }}</h2>
        <span class="docs-preview-framework">{{
          preview?.framework ?? ""
        }}</span>
      </header>
      @if (preview?.controls?.length) {
        <div class="docs-preview-controls">
          @for (control of preview?.controls; track control.name) {
            <label class="docs-preview-control">
              <span>{{ control.name }}</span>
              @if (control.typeText === "boolean") {
                <input
                  type="checkbox"
                  [checked]="asBoolean(control.value)"
                  (change)="setControl(control, $any($event.target).checked)"
                />
              } @else if (isNumber(control)) {
                <input
                  type="number"
                  [value]="control.value"
                  (input)="setControl(control, $any($event.target).valueAsNumber)"
                />
              } @else {
                <input
                  type="text"
                  [value]="asString(control.value)"
                  (input)="setControl(control, $any($event.target).value)"
                />
              }
            </label>
          }
        </div>
      }
      <div class="docs-preview-stage">
        @if (error) {
          <p class="docs-preview-error">{{ error }}</p>
        }
        <div #previewHost class="docs-preview-host"></div>
        @if (!hasComponent && !error) {
          <p class="docs-preview-fallback">
            No executable preview registered for
            <code>{{ preview?.entry }}</code>. Documented props:
            <code>{{ preview?.initialProps | json }}</code>
          </p>
        }
      </div>
      @if (preview?.events?.length) {
        <div class="docs-preview-events">
          <h3>Events</h3>
          @if (!events.length) {
            <p>No events emitted yet.</p>
          }
          <ul>
            @for (event of events; track $index) {
              <li>
                <code>{{ event.name }}</code>: {{ event.value | json }}
              </li>
            }
          </ul>
        </div>
      }
    </section>
  `,
})
export class DocsPreviewComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() value?: DocsPreviewEntry;
  @ViewChild("previewHost", { read: ViewContainerRef })
  previewHost?: ViewContainerRef;

  error?: string;
  hasComponent = false;
  events: { name: string; value: unknown }[] = [];

  private componentRef?: ComponentRef<Record<string, unknown>>;
  private subscriptions: (() => void)[] = [];

  constructor(
    private readonly runtime: DocsAngularRuntime,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  get preview(): DocsPreviewEntry | undefined {
    return this.value;
  }

  asBoolean(value: unknown): boolean {
    return Boolean(value);
  }

  asString(value: unknown): string {
    return value === undefined || value === null ? "" : String(value);
  }

  isNumber(control: DocsPreviewControlEntry): boolean {
    return (
      control.typeText === "number" ||
      typeof control.value === "number"
    );
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
    const preview = this.value;
    if (!preview) return;
    const loader =
      this.runtime.previewLoader(preview.entry) ??
      this.runtime.previewLoader(preview.uid);
    if (!loader) return;
    try {
      const component = (await loader()) as Type<Record<string, unknown>>;
      if (!this.previewHost) return;
      const ref = this.previewHost.createComponent(component);
      this.componentRef = ref;
      this.hasComponent = true;
      const inputs: Record<string, unknown> = {
        ...preview.initialProps,
        ...Object.fromEntries(
          preview.controls
            .filter((control) => control.value !== undefined)
            .map((control) => [
              control.alias ?? control.name,
              control.value,
            ])
        ),
      };
      for (const [name, value] of Object.entries(inputs)) {
        try {
          ref.setInput(name, value);
        } catch {
          // Try the documented property name when the alias does not resolve.
          try {
            ref.setInput(name, value);
          } catch {
            // Leave unsupported inputs to the component defaults.
          }
        }
      }
      this.subscribeOutputs(ref);
      this.changeDetector.detectChanges();
    } catch (error) {
      this.error = `Preview failed to load: ${
        (error as Error).message ?? error
      }`;
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
      this.error = `Failed to update "${name}": ${
        (error as Error).message ?? error
      }`;
    }
  }

  private teardown(): void {
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions = [];
    this.componentRef?.destroy();
    this.componentRef = undefined;
  }
}

/**
 * @description Registry of all Angular docs primitive component classes.
 * @summary Exported so hosts can add every primitive to a module/standalone import list at once;
 * also aliased as {@link DOCS_ANGULAR_COMPONENT_FACTORIES} for the renderer-agnostic contract.
 */
export const DOCS_ANGULAR_PRIMITIVES = [
  DocsTextComponent,
  DocsBrandComponent,
  DocsLinkComponent,
  DocsListComponent,
  DocsNavChildrenComponent,
  DocsSearchComponent,
  DocsSourceComponent,
  DocsTutorialComponent,
  DocsComponentMetadataComponent,
  DocsPreviewComponent,
];

/**
 * @description Loader type returning the Angular component class backing a docs preview.
 * @summary Async factory used by the preview registry and {@link DocsAngularRuntime}; the
 * returned constructor is instantiated by {@link DocsPreviewComponent} in the preview stage.
 */
export type DocsAngularPreviewSource = () => Promise<
  new (...args: unknown[]) => Record<string, unknown>
>;
