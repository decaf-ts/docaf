/**
 * @description Produces a canonical (key-sorted) deep copy of a value for deterministic comparison
 * and hashing.
 * @summary Recursively walks the value: objects are rebuilt with their own property keys sorted
 * ascending (deep), arrays keep their order (elements canonicalized), primitives (and null) are
 * returned as-is. Non-plain values (e.g. Dates, Maps) pass through untouched.
 * @param {unknown} value - Value to canonicalize.
 * @returns {unknown} A structurally equal copy with object keys sorted at every level.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const source = value as Record<string, unknown>;
  const target: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort())
    target[key] = canonicalize(source[key]);
  return target;
}

/**
 * @description JSON-serializes a value deterministically, independent of property insertion order.
 * @summary Runs {@link canonicalize} to sort object keys at every level and then applies
 * `JSON.stringify`; two structurally equal objects therefore always produce the same string,
 * which is what makes stable hashing of snapshot data possible.
 * @param {unknown} value - Value to serialize.
 * @returns {string} The canonical JSON string.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * @description Computes a deterministic FNV-1a 64-bit hash of a string.
 * @summary Seeds the hash with `0xcbf29ce484222325`, then for each character code XORs it into the
 * hash and multiplies by the FNV prime `0x100000001b3`, masked to 64 bits; returns the digest as
 * zero-padded 16-character lowercase hex. Same input always yields the same digest.
 * @param {string} value - String to hash.
 * @returns {string} The 64-bit digest as 16-char zero-padded lowercase hexadecimal.
 */
export function stableHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}
