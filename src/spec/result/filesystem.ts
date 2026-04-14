import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { formatDirectoryDiff } from '../reporter.js';
import {
    diffDirectories,
    type DirectoryDiff,
    type DirectorySnapshotOptions,
    walkDirectory,
} from './directory.js';

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
 * Accessor for the whole temporary working directory used by a CLI spec.
 *
 * Generalization of {@link DirectoryAccessor} that snapshots the entire CLI
 * working directory into `<test-file-dir>/expected/filesystem/<name>/`.
 */
export class FilesystemAccessor {
    /** The absolute path of the temporary working directory. */
    readonly cwd: string;
    private readonly testDir: string;

    constructor(cwd: string, testDir: string) {
        this.cwd = cwd;
        this.testDir = testDir;
    }

    /** List all files (recursively) under the working directory, sorted. */
    async files(options: { ignore?: string[] } = {}): Promise<string[]> {
        return walkDirectory(this.cwd, options);
    }

    /**
     * Assert the working directory matches a convention-based fixture tree:
     * `<test-file-dir>/expected/filesystem/<name>/`.
     */
    async toMatch(name: string, options: DirectorySnapshotOptions = {}): Promise<void> {
        const fixtureDir = resolve(this.testDir, 'expected', 'filesystem', name);
        const update = options.update ?? shouldUpdateSnapshots();

        if (update) {
            rmSync(fixtureDir, { force: true, recursive: true });
            mkdirSync(fixtureDir, { recursive: true });
            cpSync(this.cwd, fixtureDir, { recursive: true });
            return;
        }

        if (!existsSync(fixtureDir)) {
            throw new Error(
                `Filesystem fixture "${name}" does not exist at ${fixtureDir}.\n` +
                    `Run with JTERRAZZ_TEST_UPDATE=1 (or vitest -u) to create it.`,
            );
        }

        const diff: DirectoryDiff = await diffDirectories(fixtureDir, this.cwd, {
            ignore: options.ignore,
        });

        if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
            return;
        }

        throw new Error(
            formatDirectoryDiff(
                `filesystem/${name}`,
                diff,
                'Run with JTERRAZZ_TEST_UPDATE=1 to update the fixture.',
            ),
        );
    }
}
