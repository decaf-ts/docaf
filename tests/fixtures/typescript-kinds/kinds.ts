/**
 * Shape geometry contracts.
 * @category Shapes
 * @subcategory Geometry
 */
export interface Point {
  /** Horizontal position. */
  x: number;
  /** Vertical position. */
  y?: number;
}

/**
 * A named point.
 * @category Shapes
 * @subcategory Contracts
 * @augments Point
 */
export interface NamedThing extends Point {
  /** Display name. */
  name: string;
}

/**
 * Base runtime object.
 * @category Shapes
 * @subcategory Implementations
 */
export class BaseThing {
  /**
   * Runs the base implementation.
   * @param value input value
   * @param suffix optional suffix
   * @returns the rendered value
   * @example
   * <caption>Base run</caption>
   * new BaseThing().run("value")
   */
  run(value: string, suffix = "!"): string {
    return `${value}${suffix}`;
  }
}

/**
 * Derived runtime object.
 * @category Shapes
 * @subcategory Implementations
 * @augments BaseThing
 */
export class DerivedThing extends BaseThing implements NamedThing {
  /** Horizontal position. */
  x = 0;
  /** Display name. */
  name = "derived";

  /**
   * Runs the derived implementation.
   * @param value input value
   * @returns the rendered value
   * @deprecated use another method
   */
  run(value: string): string {
    return value;
  }

  /**
   * Static factory.
   * @param name display name
   * @returns the created object
   */
  static create(name = "derived"): DerivedThing {
    const thing = new DerivedThing();
    thing.name = name;
    return thing;
  }
}

/**
 * Shape kind.
 * @category Shapes
 * @subcategory Enumerations
 */
export enum ShapeKind {
  /** A circle. */
  Circle = 0,
  /** A square. */
  Square = 1,
}

/**
 * Async handler contract.
 * @category Shapes
 * @subcategory Types
 */
export type Handler = (
  input: string,
  count?: number
) => Promise<void>;

/**
 * Widget options record.
 * @category Shapes
 * @subcategory Types
 */
export type WidgetOptions = {
  /** Visible label. */
  label: string;
  /** Optional count. */
  count?: number;
  /** Nested settings. */
  nested: { flag: boolean };
};

/**
 * Identifier union.
 * @category Shapes
 * @subcategory Types
 */
export type Identifier = string | number;

/**
 * Uppercases a value.
 * @category Shapes
 * @subcategory Functions
 * @param input source text
 * @returns uppercased text
 * @example
 * <caption>Uppercase</caption>
 * toUpper("a")
 */
export function toUpper(input: string): string {
  return input.toUpperCase();
}

/**
 * Geometry namespace.
 * @category Shapes
 * @subcategory Modules
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Geometry {
  /** Origin coordinate. */
  export const origin = 0;
}
