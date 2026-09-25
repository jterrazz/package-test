import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { TokenViolation } from './checker.js';

/** The repository root, from this module's place inside `lint/`. */
export const ROOT = resolve(import.meta.dirname, '..');

/** A throwaway project holding the files given, by path. */
export function treeOf(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'source-tree-'));
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

/** Each finding of a self source pass where it sits, and what it found. */
export function located(findings: TokenViolation[]): string[] {
    return findings.map(
        ({ column, file, found, line, rule }) => `${file}:${line}:${column ?? 1} ${rule}: ${found}`,
    );
}
