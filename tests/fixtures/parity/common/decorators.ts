export function Component(_metadata: Record<string, unknown>) {
  void _metadata;
  return (target: unknown): void => {
    void target;
  };
}

export function Input(_metadata?: Record<string, unknown> | string) {
  void _metadata;
  return (target: unknown, propertyKey?: string | symbol): void => {
    void target;
    void propertyKey;
  };
}

export function Output() {
  return (target: unknown, propertyKey?: string | symbol): void => {
    void target;
    void propertyKey;
  };
}

export class EventEmitter<T> {
  emit(_value: T): void {
    void _value;
  }
}
