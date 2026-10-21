import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { EVIDENCE_DIR, evidenceFile } from '../artifacts.js';

describe('artifacts', () => {
    const made: string[] = [];

    afterAll(() => {
        for (const path of made) {
            rmSync(dirname(path), { force: true, recursive: true });
        }
    });

    test('a failing scenario screenshot is filed in a folder of its own, under the run and named for its kind', () => {
        // Given - two screenshots of the same kind, and one of another
        made.push(evidenceFile('website'), evidenceFile('website'), evidenceFile('mobile'));
        const [first = '', second = '', mobile = ''] = made;

        // Then - each a failure.png of its own folder, under the run's evidence and its kind's prefix
        const run = resolve(EVIDENCE_DIR, basename(tmpdir()));
        expect({
            folders: made.map((path) => existsSync(dirname(path))),
            mobile: [dirname(dirname(mobile)), basename(dirname(mobile)).startsWith('mobile-')],
            names: made.map((path) => basename(path)),
            website: [dirname(dirname(first)), basename(dirname(first)).startsWith('website-')],
            distinct: dirname(first) !== dirname(second),
        }).toStrictEqual({
            distinct: true,
            folders: [true, true, true],
            mobile: [run, true],
            names: ['failure.png', 'failure.png', 'failure.png'],
            website: [run, true],
        });
    });
});
