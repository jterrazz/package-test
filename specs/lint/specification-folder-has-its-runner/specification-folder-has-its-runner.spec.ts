import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('specification-folder-has-its-runner', () => {
    test('rejects a specification folder with no runner', async () => {
        // Given - a tree violating `specification-folder-has-its-runner`
        const result = await checker
            .fixture(directory('./__fixtures__/specification-folder-has-its-runner/'))
            .run();

        // Then - the pass names the file and what to do about it
        expect(result.report).toMatch(`
            specs/job:1:1  jterrazz-check(specification-folder-has-its-runner)
                found: \`specs/job/\`, a specification folder with no runner constructing \`specification.job()\`
                why: A first-level folder named for one of the eight specifications holds a \`*.specification.ts(x)\` calling \`specification.<specification>(\`.
                fix: create \`specs/job/job.specification.ts\` calling \`specification.job()\`, or rename the folder
                read: docs/reference/linting.md#specification-folder-has-its-runner
        `);
    });

    test('accepts a specification folder holding the runner it promises', async () => {
        // Given - the compliant twin
        const result = await checker
            .fixture(directory('./__fixtures__/specification-folder-has-its-runner-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
