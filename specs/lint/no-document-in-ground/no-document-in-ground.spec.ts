import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('no-document-in-ground', () => {
    test('rejects a document filed under ground', async () => {
        // Given - a tree violating \`no-document-in-ground\`
        const result = await checker.fixture(directory('./_fixtures/no-document-in-ground/')).run();

        // Then - the pass names the file and what to do about it
        expect(result.report).toMatch(`
            specs/widget:1:1  jterrazz-check(no-unused-ground)
                found: a domain folder holding _expected and no test or document
                why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: write the test that stands on _expected, or delete the folder
                read: docs/19-linting.md#no-unused-ground
            specs/widget/_expected/builds.spec.yaml:1:1  jterrazz-check(no-document-in-ground)
                found: a \`.spec.yaml\` document under a ground folder
                why: A \`<case>.spec.yaml\` is a SPEC, not ground: a document under \`_expected/\`, \`_requests/\`, \`_seeds/\` or \`_fixtures/\` is an error.
                fix: move builds.spec.yaml out of the ground folder, beside the test that runs it
                read: docs/19-linting.md#no-document-in-ground
        `);
    });

    test('accepts a document beside the test that runs it', async () => {
        // Given - the compliant twin
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/spec-document-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
