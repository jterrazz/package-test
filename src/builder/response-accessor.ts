import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { formatResponseDiff } from '../utilities/reporter.js';

export class ResponseAccessor {
    readonly body: unknown;
    private testDir: string;

    constructor(body: unknown, testDir: string) {
        this.body = body;
        this.testDir = testDir;
    }

    toMatchFile(file: string): void {
        const expected = JSON.parse(readFileSync(resolve(this.testDir, 'responses', file), 'utf8'));
        if (JSON.stringify(this.body) !== JSON.stringify(expected)) {
            throw new Error(formatResponseDiff(file, expected, this.body));
        }
    }
}
