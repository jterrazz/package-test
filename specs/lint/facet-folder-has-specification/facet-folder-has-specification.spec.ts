import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('facet-folder-has-specification', () => {
    test('rejects a facet folder with no specification', async () => {
        // Given - a tree violating `facet-folder-has-specification`
        const result = await checker
            .fixture(directory('./_fixtures/facet-folder-has-specification/'))
            .run();

        // Then - the pass names the file and what to do about it
        expect(result.report).toMatch(`
            specs/job:1:1  jterrazz-check(facet-folder-has-specification)
                found: \`specs/job/\`, a facet folder with no specification constructing \`specification.job()\`
                why: A first-level folder named for one of the seven facets holds a \`*.specification.ts(x)\` calling \`specification.<facet>(\`.
                fix: create \`specs/job/job.specification.ts\` calling \`specification.job()\`, or rename the folder
                read: docs/19-linting.md#facet-folder-has-specification
        `);
    });

    test('accepts a facet folder holding the runner it promises', async () => {
        // Given - the compliant twin
        const result = await checker
            .fixture(directory('./_fixtures/facet-folder-has-specification-ok/'))
            .run();

        // Then - the clean summary
        expect(result.report).toMatch('');
    });
});
