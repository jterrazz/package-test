import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-snapshot-folder', () => {
    test('goldens kept in _expected/ pass, and a folder of code named for goldens is no ground', async () => {
        // Given - the _expected tree
        const result = await checker.fixture(directory('./_fixtures/_expected/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a folder named for goldens in any other word is refused, in specs/ and beside a module alike', async () => {
        // Given - the synonyms tree
        const result = await checker.fixture(directory('./_fixtures/synonyms/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/golden/:1:1  jterrazz-check(no-snapshot-folder)
                found: \`golden/\`, a synonym of \`_expected/\`
                why: One word per meaning: a folder named \`snapshots/\`, \`__snapshots__/\`, \`golden/\` or \`goldens/\` is an error anywhere in a member when a test would stand on it — any such folder under \`specs/\`, and elsewhere one that holds no module of code (a \`goldens/\` folder of matcher source is named for what its code does).
                fix: rename \`golden/\` to \`_expected/\`, beside the test that reads it
                read: docs/19-linting.md#no-snapshot-folder
            specs/api/orders/snapshots/:1:1  jterrazz-check(no-snapshot-folder)
                found: \`snapshots/\`, a synonym of \`_expected/\`
                why: One word per meaning: a folder named \`snapshots/\`, \`__snapshots__/\`, \`golden/\` or \`goldens/\` is an error anywhere in a member when a test would stand on it — any such folder under \`specs/\`, and elsewhere one that holds no module of code (a \`goldens/\` folder of matcher source is named for what its code does).
                fix: rename \`snapshots/\` to \`_expected/\`, beside the test that reads it
                read: docs/19-linting.md#no-snapshot-folder
            src/__snapshots__/:1:1  jterrazz-check(no-snapshot-folder)
                found: \`__snapshots__/\`, a synonym of \`_expected/\`
                why: One word per meaning: a folder named \`snapshots/\`, \`__snapshots__/\`, \`golden/\` or \`goldens/\` is an error anywhere in a member when a test would stand on it — any such folder under \`specs/\`, and elsewhere one that holds no module of code (a \`goldens/\` folder of matcher source is named for what its code does).
                fix: rename \`__snapshots__/\` to \`_expected/\`, beside the test that reads it
                read: docs/19-linting.md#no-snapshot-folder
            src/report/goldens/:1:1  jterrazz-check(no-snapshot-folder)
                found: \`goldens/\`, a synonym of \`_expected/\`
                why: One word per meaning: a folder named \`snapshots/\`, \`__snapshots__/\`, \`golden/\` or \`goldens/\` is an error anywhere in a member when a test would stand on it — any such folder under \`specs/\`, and elsewhere one that holds no module of code (a \`goldens/\` folder of matcher source is named for what its code does).
                fix: rename \`goldens/\` to \`_expected/\`, beside the test that reads it
                read: docs/19-linting.md#no-snapshot-folder
        `);
    });
});
