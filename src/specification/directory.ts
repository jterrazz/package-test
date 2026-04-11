import { readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

/**
 * Default ignore patterns — paths that should never appear in a tracked snapshot.
 * Each entry is matched against any path segment OR a path prefix.
 */
const DEFAULT_IGNORES = [".git", ".DS_Store", "node_modules", ".next", "dist", ".turbo", ".cache"];

export interface DirectoryDiff {
  added: string[];
  changed: { path: string; expected: string; actual: string }[];
  removed: string[];
}

interface WalkOptions {
  ignore?: string[];
}

/**
 * Recursively walk a directory, returning sorted relative paths of files only.
 * Ignored entries (default + caller-supplied) are skipped.
 */
export async function walkDirectory(root: string, options: WalkOptions = {}): Promise<string[]> {
  const ignores = new Set([...DEFAULT_IGNORES, ...(options.ignore ?? [])]);
  const out: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(current);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ignores.has(entry)) {
        continue;
      }
      const abs = resolve(current, entry);
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        await walk(abs);
      } else if (stat.isFile()) {
        out.push(relative(root, abs).split(sep).join("/"));
      }
    }
  }

  await walk(root);
  out.sort();
  return out;
}

/**
 * Compare two directory trees file-by-file.
 * Binary files are compared by byte equality but reported without inline diff.
 */
export async function diffDirectories(
  expectedRoot: string,
  actualRoot: string,
  options: WalkOptions = {},
): Promise<DirectoryDiff> {
  const expectedFiles = await walkDirectory(expectedRoot, options);
  const actualFiles = await walkDirectory(actualRoot, options);

  const expectedSet = new Set(expectedFiles);
  const actualSet = new Set(actualFiles);

  const added = actualFiles.filter((f) => !expectedSet.has(f));
  const removed = expectedFiles.filter((f) => !actualSet.has(f));
  const changed: DirectoryDiff["changed"] = [];

  for (const file of expectedFiles) {
    if (!actualSet.has(file)) {
      continue;
    }
    const expected = readFileSync(resolve(expectedRoot, file), "utf8");
    const actual = readFileSync(resolve(actualRoot, file), "utf8");
    if (expected !== actual) {
      changed.push({ actual, expected, path: file });
    }
  }

  return { added, changed, removed };
}
