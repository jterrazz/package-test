import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('spec-named-for-its-aspect', () => {
    test('a spec named for the question it asks passes', async () => {
        // Given - the named tree
        const result = await lint.fixture(directory('./_fixtures/named/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a spec named for what fit nowhere else is refused at its first line', async () => {
        // Given - the generic tree
        const result = await lint.fixture(directory('./_fixtures/generic/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/events/list/misc.spec.ts:1:1  jterrazz(spec-named-for-its-aspect)
                found: the aspect "misc" names no question about the subject
                why: A spec file is named for its aspect: kebab-case (\`not-found.spec.ts\`), and never a name that says the file holds what fit nowhere else — \`misc\`, \`other\`, \`basic\`, \`general\`, \`more\`, \`edge-cases\`, \`tests\`, \`main\`.
                fix: rename the file for what its tests ask — \`pagination\`, \`filters\`, \`validation\`, \`not-found\`, \`auth\`, \`shape\` — and split it when they ask several
                read: docs/19-linting.md#spec-named-for-its-aspect
        `);
    });
});
