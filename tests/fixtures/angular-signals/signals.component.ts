import {
  Component,
  EventEmitter,
  Input,
  Output,
} from "../vertical-slice/src/decorators";

function input<T>(value?: T): T {
  return value as T;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace input {
  export function required<T>(): T {
    return undefined as T;
  }
}

function model<T>(value: T): T {
  return value;
}

function output<T>(): T {
  return undefined as T;
}

/**
 * Signal based fixture component.
 * @category Components
 * @subcategory Signals
 * @component
 */
@Component({ selector: "sig-widget", standalone: false })
export class SignalWidgetComponent {
  /** Signal label. */
  label = input("hello");

  /** Required count. */
  count = input.required<number>();

  /** Two-way value. */
  value = model(3);

  /** Aliased signal title. */
  title = input("title", { alias: "displayTitle", required: true });

  /** Emitted on save. */
  saved = output<{ id: number }>();

  /** Legacy input with an alias. */
  @Input({ alias: "legacyAlias", required: true }) legacy = "legacy";

  /** Legacy output with an alias. */
  @Output("closed") close = new EventEmitter<void>();
}
