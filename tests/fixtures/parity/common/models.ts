/**
 * Numeric identifier.
 * @category Parity
 * @subcategory Contracts
 */
export type Identifier = string | number;

/**
 * Imported record reference.
 * @category Parity
 * @subcategory Contracts
 */
export type ImportedRecord = import("./imported").Imported;

/**
 * Pair of values.
 * @category Parity
 * @subcategory Contracts
 * @template T, U
 */
export interface Pair<T, U> {
  /** First value. */
  readonly first: T;
  /** Second value. */
  second: U;
  /** Optional label. */
  label?: string;
}

/**
 * Nested options record.
 * @category Parity
 * @subcategory Contracts
 */
export type Options = {
  /** Visible label. */
  label: string;
  /** Optional count. */
  count?: number;
  /** Nested settings. */
  nested: { flag: boolean; tags: string[] };
};

/**
 * Combined contract.
 * @category Parity
 * @subcategory Contracts
 */
export type Combined = Pair<string, number> & { extra?: boolean };

/**
 * Base runtime object.
 * @category Parity
 * @subcategory Implementations
 */
export class BaseModel {
  /** Base name. */
  name = "base";

  /**
   * Formats a value.
   * @param value input value
   * @param suffix optional suffix
   * @returns formatted value
   * @example
   * <caption>Format</caption>
   * new BaseModel().format("a")
   */
  format(value: string, suffix = "!"): string {
    return `${value}${suffix}`;
  }
}

/**
 * Derived runtime object.
 * @category Parity
 * @subcategory Implementations
 * @augments BaseModel
 * @custom-tag preserved value
 */
export class DerivedModel extends BaseModel implements Pair<string, number> {
  /** First value. */
  readonly first = "a";
  /** Second value. */
  second = 1;
  /** Optional label. */
  label?: string;
  /** Protected state. */
  protected state = 0;
  /** Private secret. */
  private secret = "";
  /** Static count. */
  static count = 0;

  /**
   * Creates a derived model.
   * @param first first value
   */
  constructor(first = "a") {
    super();
    this.first = first;
  }

  /**
   * Processes a value.
   * @param value input value
   * @returns processed value
   * @deprecated use format
   */
  process(value: string): string;
  /**
   * Processes a numeric value.
   * @param value input value
   * @returns processed value
   */
  process(value: number): string;
  process(value: string | number): string {
    return String(value);
  }

  /**
   * Loads external documentation.
   * @load ./loaded.md
   * @category Parity
   * @subcategory Implementations
   */
  loaded(): string {
    return "";
  }

  /**
   * Async handler.
   * @param input source value
   * @returns nothing
   */
  async handle(input: string): Promise<void> {
    void input;
  }

  /**
   * Static factory.
   * @param name display name
   * @returns created model
   */
  static create(name = "derived"): DerivedModel {
    return new DerivedModel(name);
  }
}
