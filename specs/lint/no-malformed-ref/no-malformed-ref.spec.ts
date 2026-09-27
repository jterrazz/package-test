import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('no-malformed-ref', () => {
    test('rejects a malformed capture ref on a known kind', async () => {
        // Given - an expected fixture with {{iso8601#}} (empty ref)
        const result = await checker.fixture(directory('./_fixtures/no-malformed-ref/')).run();

        // Then - the checker fails with the full diagnostic naming the offending token
        expect(result.report).toMatch(`
            specs/widget/_expected/out.txt:1:1  jterrazz-check(no-malformed-ref)
                found: the malformed token {{iso8601#}}
                why: A malformed ref of a known kind (\`{{iso8601#}}\`, \`{{uuid #id}}\`) in a text file under \`_expected/\` is an error.
                fix: write iso8601 bare, or its named capture iso8601#<name>, between double braces
                read: docs/19-linting.md#no-malformed-ref
        `);
    });

    test('accepts a well-formed capture ref', async () => {
        // Given - the compliant twin ({{iso8601#when}})
        const result = await checker.fixture(directory('./_fixtures/no-malformed-ref-ok/')).run();

        // Then - the clean summary (0 warnings) on stdout
        expect(result.report).toMatch('');
    });
});
