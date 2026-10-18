import { Component, EventEmitter, Input, Output } from "@angular/core";

/**
 * Real Angular fixture component.
 * @category Components
 * @subcategory Widgets
 * @component
 */
@Component({
  selector: "doc-widget",
  standalone: true,
  template: `
    <div class="native-widget">
      <p class="native-widget-marker">Native Angular preview</p>
      <p class="native-widget-label">label: {{ label }}</p>
      <p class="native-widget-count">count: {{ count }}</p>
      <button type="button" (click)="changed.emit({ value: label })">
        emit native
      </button>
    </div>
  `,
})
export class DocWidgetComponent {
  /** Visible label. */
  @Input() label = "hello";

  /** Item count. */
  @Input({ alias: "itemCount", required: true }) count!: number;

  /** Emitted when the label changes. */
  @Output() changed = new EventEmitter<{ value: string }>();
}
