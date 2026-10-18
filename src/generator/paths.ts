import path from "node:path";

function asDirectory(value: string): string {
  const resolved = path.resolve(value);
  return /\.[cm]?[jt]sx?$/.test(resolved) ? path.dirname(resolved) : resolved;
}

/**
 * @description Computes the deepest directory shared by all given paths.
 * @summary Resolves each path (stripping file names that look like
 * `.ts`/`.js`/`.jsx` source files) and walks upwards from the first path until
 * every other path is contained within it. Returns the process current working
 * directory for an empty input, and stops at the filesystem root when paths
 * share no common ancestor.
 * @param {string[]} paths - The file or directory paths to intersect.
 * @returns {string} The common ancestor directory as an absolute path.
 */
export function commonDirectory(paths: readonly string[]): string {
  if (!paths.length) return process.cwd();
  let common = asDirectory(paths[0]);
  for (const candidate of paths.slice(1)) {
    const next = asDirectory(candidate);
    while (
      next !== common &&
      !next.startsWith(`${common}${path.sep}`)
    ) {
      const parent = path.dirname(common);
      if (parent === common) return common;
      common = parent;
    }
  }
  return common;
}
