import { readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

import { CaptureScope } from '../tokens/match.js';
import { textEquals } from '../tokens/structural.js';

const DEFAULT_IGNORES = ['.git', '.DS_Store', 'node_modules', '.next', 'dist', '.turbo', '.cache'];

export type DirectoryDiff = {
    added: string[];
    changed: { path: string; expected: string; actual: string }[];
    removed: string[];
};

export async function walkDirectory(
    root: string,
    options: { ignore?: string[] } = {},
): Promise<string[]> {
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
                out.push(relative(root, abs).split(sep).join('/'));
            }
        }
    }

    await walk(root);
    out.sort();
    return out;
}

/** Fixture contents honour the `{{token}}` grammar (`no-unknown-token`); captures recorded in sorted-path order. */
export async function diffDirectories(
    expectedRoot: string,
    actualRoot: string,
    options: { ignore?: string[]; scope?: CaptureScope } = {},
): Promise<DirectoryDiff> {
    const expectedFiles = await walkDirectory(expectedRoot, options);
    const actualFiles = await walkDirectory(actualRoot, options);
    const expectedSet = new Set(expectedFiles);
    const actualSet = new Set(actualFiles);
    const scope = options.scope ?? new CaptureScope();

    const added = actualFiles.filter((f) => !expectedSet.has(f));
    const removed = expectedFiles.filter((f) => !actualSet.has(f));
    const changed: DirectoryDiff['changed'] = [];

    for (const file of expectedFiles) {
        if (!actualSet.has(file)) {
            continue;
        }
        const expected = readFileSync(resolve(expectedRoot, file), 'utf8');
        const actual = readFileSync(resolve(actualRoot, file), 'utf8');
        if (!textEquals(expected, actual, scope)) {
            changed.push({ actual, expected, path: file });
        }
    }

    return { added, changed, removed };
}

/** Read-only accessor for a directory a spec action produced. */
export class DirectoryAccessor {
    /** @internal */
    readonly captures: CaptureScope;
    /** @internal Absolute path of the directory under assertion. */
    readonly root: string;
    /** @internal */
    readonly testDir: string;

    constructor(absPath: string, testDir: string, captures?: CaptureScope) {
        this.root = absPath;
        this.testDir = testDir;
        this.captures = captures ?? new CaptureScope();
    }

    /** List all files (recursively) under the directory, sorted. */
    async files(options: { ignore?: string[] } = {}): Promise<string[]> {
        return await walkDirectory(this.root, options);
    }
}
