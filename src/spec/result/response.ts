import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { formatResponseDiff } from '../reporter.js';

/** Accessor for an HTTP response body with file-based assertion support. */
export class ResponseAccessor {
    readonly body: unknown;
    private testDir: string;

    constructor(body: unknown, testDir: string) {
        this.body = body;
        this.testDir = testDir;
    }

    /**
     * Assert that the response body matches the JSON in `responses/{file}`.
     *
     * @example
     *   result.response.toMatchFile("expected-items.json");
     */
    toMatchFile(file: string): void {
        const expected = JSON.parse(readFileSync(resolve(this.testDir, 'responses', file), 'utf8'));
        if (JSON.stringify(this.body) !== JSON.stringify(expected)) {
            throw new Error(formatResponseDiff(file, expected, this.body));
        }
    }
}
