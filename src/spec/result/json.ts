import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import { formatResponseDiff } from '../reporter.js';

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

export interface JsonSnapshotOptions {
    update?: boolean;
}

function formatJson(value: unknown): string {
    return `${JSON.stringify(value, null, 4)}\n`;
}

/**
 * Accessor for a JSON payload parsed from a text stream (stdout).
 *
 * Lazily parses the JSON on first use; parse errors are deferred until an
 * assertion is performed so that callers can still read the raw stream text
 * without triggering a throw.
 */
export class JsonAccessor {
    private readonly rawText: string;
    private readonly testDir: string;

    constructor(rawText: string, testDir: string) {
        this.rawText = rawText;
        this.testDir = testDir;
    }

    /** The parsed JSON value. Throws if the text is not valid JSON. */
    get value(): unknown {
        return this.parse();
    }

    /**
     * Assert the parsed JSON deep-equals the JSON in the given file on disk.
     *
     * Path is resolved relative to the test file directory unless absolute.
     * If `JTERRAZZ_TEST_UPDATE=1` (or vitest `-u`), the file is (re)written
     * with the pretty-printed parsed value.
     */
    toMatchFile(path: string, options: JsonSnapshotOptions = {}): void {
        const absPath = isAbsolute(path) ? path : resolve(this.testDir, path);
        const update = options.update ?? shouldUpdateSnapshots();
        const actual = this.parse();

        if (update) {
            mkdirSync(dirname(absPath), { recursive: true });
            writeFileSync(absPath, formatJson(actual));
            return;
        }

        if (!existsSync(absPath)) {
            throw new Error(
                `JSON fixture "${path}" does not exist at ${absPath}.\n` +
                    `Run with JTERRAZZ_TEST_UPDATE=1 (or vitest -u) to create it.`,
            );
        }

        const expected = JSON.parse(readFileSync(absPath, 'utf8'));
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            throw new Error(formatResponseDiff(path, expected, actual));
        }
    }

    /**
     * Assert the parsed JSON matches a convention-based fixture:
     * `<test-file-dir>/expected/json/<name>.json`.
     */
    toMatchFixture(name: string, options: JsonSnapshotOptions = {}): void {
        const fileName = name.endsWith('.json') ? name : `${name}.json`;
        const absPath = resolve(this.testDir, 'expected', 'json', fileName);
        this.toMatchFile(absPath, options);
    }

    private parse(): unknown {
        try {
            return JSON.parse(this.rawText);
        } catch {
            const preview = this.rawText.slice(0, 200);
            throw new Error(`stdout is not valid JSON: ${preview}`);
        }
    }
}
