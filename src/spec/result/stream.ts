import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import { formatStdoutDiff } from '../reporter.js';

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

export interface StreamSnapshotOptions {
    update?: boolean;
}

/**
 * Accessor for a captured text stream (stdout/stderr) with file-based
 * assertion support.
 *
 * Backed by a primitive string, exposed via {@link text}, but also provides
 * `toString()` / `valueOf()` for string coercion, so common patterns like
 * `String(result.stdout)` and template-literal interpolation still work.
 */
export class StreamAccessor {
    private readonly streamName: string;
    private readonly testDir: string;
    readonly text: string;

    constructor(text: string, streamName: string, testDir: string) {
        this.text = text;
        this.streamName = streamName;
        this.testDir = testDir;
    }

    /**
     * Assert the captured text matches the given file on disk.
     *
     * Path is resolved relative to the test file directory unless absolute.
     * If `JTERRAZZ_TEST_UPDATE=1` (or vitest `-u`), the file is (re)written
     * with the actual text.
     */
    toMatchFile(path: string, options: StreamSnapshotOptions = {}): void {
        const absPath = isAbsolute(path) ? path : resolve(this.testDir, path);
        const update = options.update ?? shouldUpdateSnapshots();

        if (update) {
            mkdirSync(dirname(absPath), { recursive: true });
            writeFileSync(absPath, this.text);
            return;
        }

        if (!existsSync(absPath)) {
            throw new Error(
                `${this.streamName} fixture "${path}" does not exist at ${absPath}.\n` +
                    `Run with JTERRAZZ_TEST_UPDATE=1 (or vitest -u) to create it.`,
            );
        }

        const expected = readFileSync(absPath, 'utf8');
        if (expected !== this.text) {
            throw new Error(formatStdoutDiff(path, expected, this.text));
        }
    }

    /**
     * Assert the captured text matches a convention-based fixture:
     * `<test-file-dir>/expected/<stream>/<name>.txt`.
     */
    toMatchFixture(name: string, options: StreamSnapshotOptions = {}): void {
        const fileName = name.endsWith('.txt') ? name : `${name}.txt`;
        const absPath = resolve(this.testDir, 'expected', this.streamName, fileName);
        this.toMatchFile(absPath, options);
    }

    toString(): string {
        return this.text;
    }

    valueOf(): string {
        return this.text;
    }
}
