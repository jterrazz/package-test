import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('member-has-vitest-config', () => {
    test('a member whose tests run on a config of its own passes, and so does a root delegating its tests', async () => {
        // Given - the member-workspace tree
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/member-workspace/'))
            .run({ args: '--member packages/clean' });
        const next = await checker
            .fixture(directory('../../_shared/_fixtures/member-workspace/'))
            .run({ args: '--member .' });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(next.report).toMatch('');
    });

    test('a member with a test script of its own and no vitest config is refused', async () => {
        // Given - the member-workspace tree
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/member-workspace/'))
            .run({ args: '--member packages/tested-no-config' });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            packages/tested-no-config/package.json:1:1  jterrazz-check(member-has-vitest-config)
                found: packages/tested-no-config has no vitest.config.ts — vitest's 5 s budget and an unexcluded \`_fixtures/\` are running its tests
                why: Every workspace member with tests OF ITS OWN (a \`test\` script that does not delegate to members, or a \`*.test.ts(x)\` outside another package’s tree) declares a vitest config (\`vitest.config.*\`).
                fix: write packages/tested-no-config/vitest.config.ts: \`export default defineSpecConfig()\`, from \`@jterrazz/test/vitest\`
                read: docs/24-linting.md#member-has-vitest-config
        `);
    });
});
