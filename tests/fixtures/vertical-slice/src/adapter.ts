/**
 * Base adapter contract.
 * @category Adapters
 * @subcategory Contracts
 */
export interface BaseAdapter {
  readonly name: string;
}

/**
 * Memory persistence adapter.
 * @category Adapters
 * @subcategory Memory
 */
export class RamAdapter implements BaseAdapter {
  readonly name = "ram";

  /**
   * Creates a memory adapter.
   * @param name Adapter name.
   */
  constructor(name = "ram") {
    this.name = name;
  }

  /** Reads a stored value. */
  read(key: string): unknown {
    return key;
  }
}

/**
 * Adapter configuration.
 * @load ./adapter.md
 * @category Adapters
 * @subcategory Configuration
 */
export interface AdapterConfig {
  /** Number of retries. */
  retries: number;
  /** Optional adapter name. */
  name?: string;
}
