import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

import { formatDirectoryDiff } from '../reporter.js';

// ── Directory walk + diff (internal helpers) ──

const DEFAULT_IGNORES = ['.git', '.DS_Store', 'node_modules', '.next', 'dist', '.turbo', '.cache'];

export interface DirectoryDiff {
    added: string[];
    changed: { path: string; expected: string; actual: string }[];
    removed: string[];
}

/**
 * Recursively walk a directory, returning sorted relative paths of files only.
 */
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

/**
 * Compare two directory trees file-by-file.
 */
export async function diffDirectories(
    expectedRoot: string,
    actualRoot: string,
    options: { ignore?: string[] } = {},
): Promise<DirectoryDiff> {
    const expectedFiles = await walkDirectory(expectedRoot, options);
    const actualFiles = await walkDirectory(actualRoot, options);
    const expectedSet = new Set(expectedFiles);
    const actualSet = new Set(actualFiles);

    const added = actualFiles.filter((f) => !expectedSet.has(f));
    const removed = expectedFiles.filter((f) => !actualSet.has(f));
    const changed: DirectoryDiff['changed'] = [];

    for (const file of expectedFiles) {
        if (!actualSet.has(file)) {
            continue;
        }
        const expected = readFileSync(resolve(expectedRoot, file), 'utf8');
        const actual = readFileSync(resolve(actualRoot, file), 'utf8');
        if (expected !== actual) {
            changed.push({ actual, expected, path: file });
        }
    }

    return { added, changed, removed };
}

// ── DirectoryAccessor (user-facing) ──

export interface DirectorySnapshotOptions {
    ignore?: string[];
    update?: boolean;
}

function shouldUpdateSnapshots(): boolean {
    if (process.env.JTERRAZZ_TEST_UPDATE === '1') {
        return true;
    }
    if (process.env.UPDATE_SNAPSHOTS === '1') {
        return true;
    }
    if (process.argv.includes('-u') || process.argv.includes('--update')) {
        return true;
    }
    return false;
}

export class DirectoryAccessor {
    private absPath: string;
    private testDir: string;

    constructor(absPath: string, testDir: string) {
        this.absPath = absPath;
        this.testDir = testDir;
    }

    async toMatchFixture(name: string, options: DirectorySnapshotOptions = {}): Promise<void> {
        const fixtureDir = resolve(this.testDir, 'expected', name);
        const update = options.update ?? shouldUpdateSnapshots();

        if (update) {
            rmSync(fixtureDir, { force: true, recursive: true });
            mkdirSync(fixtureDir, { recursive: true });
            cpSync(this.absPath, fixtureDir, { recursive: true });
            return;
        }

        if (!existsSync(fixtureDir)) {
            throw new Error(
                `Directory fixture "${name}" does not exist at ${fixtureDir}.\n` +
                    `Run with JTERRAZZ_TEST_UPDATE=1 (or vitest -u) to create it.`,
            );
        }

        const diff: DirectoryDiff = await diffDirectories(fixtureDir, this.absPath, {
            ignore: options.ignore,
        });

        if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
            return;
        }

        throw new Error(
            formatDirectoryDiff(
                name,
                diff,
                'Run with JTERRAZZ_TEST_UPDATE=1 to update the fixture.',
            ),
        );
    }

    async files(options: { ignore?: string[] } = {}): Promise<string[]> {
        return walkDirectory(this.absPath, options);
    }
}
