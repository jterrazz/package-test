import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('facet-test-uses-its-runner', () => {
    test('rejects a spec that reaches no runner under its facet', async () => {
        // Given - a tree violating `facet-test-uses-its-runner`
        const result = await checker
            .fixture(directory('./_fixtures/facet-test-uses-its-runner/'))
            .run();

        // Then - the pass names the file and what to do about it
        expect(result.report).toMatch(`
            specs/api/orders/total.spec.ts:1:1  jterrazz-check(facet-test-uses-its-runner)
                found: a test under the \`api\` facet that reaches no runner
                why: A test under \`specs/<facet>/\`, where the facet root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself.
                fix: import \`{ api }\` from \`api.specification.js\` and drive the product through it, or move the module test beside its module
                read: docs/19-linting.md#facet-test-uses-its-runner
        `);
    });

    test('leaves a golden under `_expected/` alone, as it leaves `_fixtures/`', async () => {
        // Given - the compliant twin, whose ground holds a `.test.ts` that IS a golden: the file a fixer is expected to write
        const result = await checker
            .fixture(directory('./_fixtures/facet-test-uses-its-runner-ok/'))
            .run();

        // Then - ground is ground whichever of the four names it carries: nothing under an underscored folder reaches a runner
        expect(result.report).toMatch('');
    });

    test('accepts a spec that imports the runner of its facet', async () => {
        // Given - the compliant twin, whose second spec names the specification module with no extension
        const result = await checker
            .fixture(directory('./_fixtures/facet-test-uses-its-runner-ok/'))
            .run();

        // Then - nothing is reported: the import SOURCE is what reaches the runner, however it spells the extension
        expect(result.report).toMatch('');
    });
});
