import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { diffDirectories, type DirectoryDiff, walkDirectory } from './directory.js';
import { formatDirectoryDiff } from './reporter.js';

export interface DirectorySnapshotOptions {
    /** Extra path segments to ignore (in addition to default: .git, node_modules, etc.). */
    ignore?: string[];
    /**
     * Force update mode regardless of vitest flags / env vars.
     * `true` writes the fixture, `false` always asserts. Defaults to auto-detect.
     */
    update?: boolean;
}

/**
 * Detect whether the user wants to update snapshots — `true` for any of:
 *   - vitest run with `-u` / `--update`
 *   - JTERRAZZ_TEST_UPDATE=1
 *   - UPDATE_SNAPSHOTS=1
 */
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

/**
 * Handle to a directory produced by a specification run.
 * Supports snapshot-based assertions via {@link toMatchFixture} and file listing via {@link files}.
 */
export class DirectoryAccessor {
    private absPath: string;
    private testDir: string;

    constructor(absPath: string, testDir: string) {
        this.absPath = absPath;
        this.testDir = testDir;
    }

    /**
     * Compare the directory tree against `expected/{name}/` (relative to the test file).
     * On mismatch, throws with a structured diff. With update mode enabled, the
     * fixture is overwritten with the current contents instead.
     */
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

    /**
     * List all files in the directory (recursive, sorted, ignoring defaults).
     * Useful for ad-hoc assertions when you don't want a full snapshot.
     */
    async files(options: { ignore?: string[] } = {}): Promise<string[]> {
        return walkDirectory(this.absPath, options);
    }
}
