import { CommonModule } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { ModelRendererComponent } from "@decaf-ts/for-angular";
import { filter, Subscription } from "rxjs";
import type { DocsSiteLayout } from "../../ui/layouts/DocsSiteLayout";
import { DocsAngularRuntime } from "../runtime/DocsAngularRuntime";

/**
 * @description Angular route host component that renders a docs page layout for the current route.
 * @summary Standalone component (`docs-page-host`) used as the catch-all route target of the
 * static docs application. On init it subscribes to router `NavigationEnd` events and loads the
 * matching {@link DocsSiteLayout} from the {@link DocsAngularRuntime} page service (initializing
 * the runtime on first use); repeated routes are skipped. Renders the layout through the Decaf
 * model renderer, or a loading/error placeholder while the snapshot is unavailable, and cleans
 * up its subscription on destroy.
 * @class DocsPageHostComponent
 */
@Component({
  selector: "docs-page-host",
  standalone: true,
  imports: [CommonModule, ModelRendererComponent],
  template: `
    @if (layout) {
      <ngx-decaf-model-renderer [model]="layout" />
    } @else if (error) {
      <div class="docs-page-error" role="alert">
        <h1>Documentation unavailable</h1>
        <p>{{ error }}</p>
      </div>
    } @else {
      <div class="docs-page-loading" role="status">Loading documentation…</div>
    }
  `,
})
export class DocsPageHostComponent implements OnInit, OnDestroy {
  layout?: DocsSiteLayout;
  error?: string;

  private subscription?: Subscription;
  private currentRoute?: string;

  constructor(
    private readonly runtime: DocsAngularRuntime,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.subscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => void this.load(event.urlAfterRedirects));
    await this.load(this.router.url);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private async load(route: string): Promise<void> {
    if (route === this.currentRoute) return;
    this.currentRoute = route;
    this.error = undefined;
    try {
      const service = await this.runtime.initialize();
      this.layout = await service.resolveLayout(route);
    } catch (error) {
      this.layout = undefined;
      this.error = (error as Error).message ?? String(error);
    }
    this.changeDetector.detectChanges();
  }
}
