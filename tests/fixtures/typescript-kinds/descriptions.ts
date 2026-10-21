/**
 * Pre-tag prose wins over every tag.
 * @description Tag description loses.
 * @summary Tag summary loses.
 */
export class ProseWins {
  /** Plain prose member. */
  value = 0;
}

/**
 * @description Description tag fills the gap.
 */
export class DescriptionOnly {
  /** Plain prose member. */
  value = 0;
}

/**
 * @summary Summary tag fills the gap.
 */
export class SummaryOnly {
  /** Plain prose member. */
  value = 0;
}

/**
 * @description Description wins over summary.
 * @summary Summary loses to description.
 */
export class BothTags {
  /** Plain prose member. */
  value = 0;
}

/**
 * Tagged members.
 */
export class TaggedMembers {
  /**
   * @description Member description wins over summary.
   * @summary Member summary loses.
   */
  taggedField = 0;

  /**
   * @summary Method summary fills the gap.
   */
  summaryMethod(): string {
    return "value";
  }
}

/**
 * @description Namespace description fills the gap.
 * @namespace descriptions
 */
export {};
