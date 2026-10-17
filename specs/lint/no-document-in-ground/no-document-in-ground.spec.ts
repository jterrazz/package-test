import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-document-in-ground', () => {
    test('rejects a document filed under ground', async () => {
        // Given - a tree violating \`no-document-in-ground\`
        const result = await checker
            .fixture(directory('./__fixtures__/no-document-in-ground/'))
            .run();

        // Then - the pass names the file and what to do about it
        expect(result.report).toMatch(`
            specs/widget:1:1  jterrazz-check(no-unused-ground)
                found: a domain folder holding __expected__ and no test or document
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced: a folder's by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: write the test that stands on __expected__, or delete the folder
                read: docs/reference/linting.md#no-unused-ground
            specs/widget/__expected__/builds.spec.yaml:1:1  jterrazz-check(no-document-in-ground)
                found: a \`.spec.yaml\` document under a ground folder
                why: A \`<case>.spec.yaml\` is a SPEC, not ground: a document under \`__expected__/\`, \`__requests__/\`, \`__seeds__/\` or \`__fixtures__/\` is an error.
                fix: move builds.spec.yaml out of the ground folder, beside the test that runs it
                read: docs/reference/linting.md#no-document-in-ground
        `);
    });

    test('accepts a document beside the test that runs it', async () => {
        // Given - the compliant twin
        const result = await checker
            .fixture(directory('../../__fixtures__/spec-document-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
