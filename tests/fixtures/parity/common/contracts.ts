/**
 * Geometry helpers.
 * @category Parity
 * @subcategory Modules
 * @namespace parity
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Helpers {
  /** Origin coordinate. */
  export const origin = 0;

  /** Coordinates type. */
  export type Coordinates = [number, number];
}

/**
 * Callback contract.
 * @category Parity
 * @subcategory Types
 */
export type Callback = (input: string, count?: number) => Promise<void>;

/**
 * Qualified reference.
 * @category Parity
 * @subcategory Types
 */
export type Qualified = Helpers.Coordinates;

/**
 * Generic lookup table.
 * @category Parity
 * @subcategory Types
 */
export type Lookup<T> = { [key: string]: T };

/**
 * Mapped pair reference.
 * @category Parity
 * @subcategory Types
 */
export type PairReference = import("./models").Pair<string, number>;

/**
 * Primitive alias.
 * @category Parity
 * @subcategory Types
 */
export type Alias = string;
