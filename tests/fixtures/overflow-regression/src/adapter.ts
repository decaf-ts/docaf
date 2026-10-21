/**
 * Base adapter contract used by the narrow-viewport overflow regression.
 * @category Adapters
 * @subcategory Contracts
 */
export interface BaseAdapter {
  /** Adapter name. */
  readonly name: string;
}

/**
 * Memory adapter whose documented members are deliberately wider than a
 * 390px viewport so the member table has to scroll internally.
 * @category Adapters
 * @subcategory Memory
 * @example
 * <caption>Reading an unbreakable class-level key</caption>
 * new RamAdapter().readWithDeliberatelyLongAdapterDescriptorFallbackChain("adapter-configuration-key-with-a-deliberately-long-unbreakable-value-that-must-scroll-inside-the-code-block");
 */
export class RamAdapter implements BaseAdapter {
  readonly name = "ram";

  /**
   * Reads a stored value for a deliberately verbose descriptor identifier.
   * This member name is intentionally long so the rendered member table
   * cannot fit inside the 390px viewport without internal scrolling.
   * @param key Adapter key.
   * @returns the stored value.
   */
  readWithDeliberatelyLongAdapterDescriptorFallbackChain(key: string): unknown {
    return key;
  }

  /**
   * Reads a stored value.
   * @param key Adapter key.
   * @returns the stored value.
   * @example
   * <caption>Reading an unbreakable key</caption>
   * new RamAdapter().readWithDeliberatelyLongAdapterDescriptorFallbackChain("adapter-configuration-key-with-a-deliberately-long-unbreakable-value-that-must-scroll-inside-the-code-block");
   */
  read(key: string): unknown {
    return key;
  }
}

/**
 * Adapter configuration used by the narrow-viewport overflow regression.
 * @category Adapters
 * @subcategory Configuration
 */
export interface AdapterConfig {
  /** Number of retries before the adapter reports a failure. */
  retries: number;
  /** Optional adapter name. */
  name?: string;
  /**
   * Deliberately verbose timeout identifier that widens the documented
   * properties table beyond a 390px viewport.
   */
  connectionInitializationTimeoutMillisecondsForFallbackAdapterDescriptorResolution?: number;
  /** Fallback chain used when the primary descriptor cannot be resolved. */
  descriptorFallbackChain?: readonly string[];
}

/**
 * Creates an adapter descriptor for a configuration.
 * @param config Adapter configuration.
 * @returns the descriptor.
 * @example
 * <caption>Creating a descriptor</caption>
 * createAdapterDescriptorWithLongConfigurationChain({ retries: 3, name: "ram", connectionInitializationTimeoutMilliseconds: 30000, descriptorFallbackChain: ["primary-adapter-descriptor", "secondary-adapter-descriptor"] });
 */
export function createAdapterDescriptorWithLongConfigurationChain(
  config: AdapterConfig
): Record<string, unknown> {
  return { ...config };
}
