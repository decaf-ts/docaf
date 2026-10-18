export type ComponentMetadata = {
  selector?: string;
  standalone?: boolean;
  template?: string;
};

export function Component(metadata: ComponentMetadata = {}): ClassDecorator {
  void metadata;
  return () => undefined;
}

export function Input(
  options?: { alias?: string; required?: boolean } | string
): PropertyDecorator {
  void options;
  return () => undefined;
}

export function Output(alias?: string): PropertyDecorator {
  void alias;
  return () => undefined;
}

export class EventEmitter<T> {
  constructor(private readonly value?: T) {}
  emit(value: T): void {
    void this.value;
    void value;
  }
}
