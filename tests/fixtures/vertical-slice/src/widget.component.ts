import {
  Component,
  EventEmitter,
  Input,
  Output,
} from "./decorators";

/**
 * Documented fixture component.
 * @category Components
 * @subcategory Widgets
 * @component
 */
@Component({ selector: "doc-widget", standalone: true })
export class DocWidgetComponent {
  /** Visible label. */
  @Input() label = "hello";

  /** Item count. */
  @Input({ alias: "itemCount", required: true }) count!: number;

  /** Emitted when the label changes. */
  @Output() changed = new EventEmitter<{ value: string }>();
}
