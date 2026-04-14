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
    private readonly transform?: (text: string) => string;
    readonly text: string;

    constructor(
        text: string,
        streamName: string,
        testDir: string,
        transform?: (text: string) => string,
    ) {
        this.text = text;
        this.streamName = streamName;
        this.testDir = testDir;
        this.transform = transform;
    }

    /**
     * Assert the captured text matches the given file on disk.
     *
     * Path is resolved relative to the test file directory unless absolute.
     * If `JTERRAZZ_TEST_UPDATE=1` (or vitest `-u`), the file is (re)written
     * with the actual text.
     *
     * When a `transform` is configured on the spec runner, it is applied to
     * the actual text before comparison (and before writing in update mode).
     * The fixture file is treated as authoritative and is NOT transformed.
     */
    toMatchFile(path: string, options: StreamSnapshotOptions = {}): void {
        const absPath = isAbsolute(path) ? path : resolve(this.testDir, path);
        const update = options.update ?? shouldUpdateSnapshots();
        const actual = this.transform ? this.transform(this.text) : this.text;

        if (update) {
            mkdirSync(dirname(absPath), { recursive: true });
            writeFileSync(absPath, actual);
            return;
        }

        if (!existsSync(absPath)) {
            throw new Error(
                `${this.streamName} fixture "${path}" does not exist at ${absPath}.\n` +
                    `Run with JTERRAZZ_TEST_UPDATE=1 (or vitest -u) to create it.`,
            );
        }

        const expected = readFileSync(absPath, 'utf8');
        if (expected !== actual) {
            throw new Error(formatStdoutDiff(path, expected, actual));
        }
    }

    /**
     * Assert the captured text matches a convention-based fixture:
     * `<test-file-dir>/expected/<stream>/<name>`.
     *
     * The extension is part of the name and must be included by the caller —
     * e.g. `toMatch('valid.txt')`, not `toMatch('valid')`. Explicit extensions
     * are clearer at the call site and remove magic from the resolution.
     */
    toMatch(name: string, options: StreamSnapshotOptions = {}): void {
        const absPath = resolve(this.testDir, 'expected', this.streamName, name);
        this.toMatchFile(absPath, options);
    }

    toString(): string {
        return this.text;
    }

    valueOf(): string {
        return this.text;
    }
}
