import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-simulated-dom-in-config', () => {
    test('a member config on the node environment passes', async () => {
        // Given - the member-workspace tree
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/member-workspace/'))
            .run({ args: '--member packages/clean' });

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a member config drawing a browser with a simulated DOM is refused', async () => {
        // Given - the member-workspace tree
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/member-workspace/'))
            .run({ args: '--member packages/simulated-dom' });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            packages/simulated-dom/jterrazz.config.ts:4:1  jterrazz-check(no-simulated-dom-in-config)
                found: \`environment: 'happy-dom'\` gives every file of this project a drawing of a browser
                why: \`environment: 'happy-dom'|'jsdom'\` in a test project of \`jterrazz.config.ts\` is an error.
                fix: delete \`environment: 'happy-dom'\`, and write each rendered test as a \`.test.tsx\` beside its component, collected by the \`component\` project
                read: docs/24-linting.md#no-simulated-dom-in-config
        `);
    });
});
