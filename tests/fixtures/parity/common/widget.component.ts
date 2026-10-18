import { Component, EventEmitter, Input, Output } from "./decorators";

/**
 * Documented Angular fixture component.
 * @category Parity
 * @subcategory Components
 * @component
 */
@Component({ selector: "parity-widget", standalone: true })
export class ParityWidgetComponent {
  /** Visible label. */
  @Input() label = "hello";

  /** Item count. */
  @Input({ alias: "itemCount", required: true }) count!: number;

  /** Emitted when the label changes. */
  @Output() changed = new EventEmitter<{ value: string }>();
}
