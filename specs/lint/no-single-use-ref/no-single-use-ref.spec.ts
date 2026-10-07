import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-single-use-ref', () => {
    test('rejects a single-use capture ref', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:11:40  jterrazz(no-single-use-ref)
                found: the capture ref "order" is used once in this spec
                why: A capture ref (\`match.ref\`, \`{{kind#ref}}\`) appearing exactly once in the whole file (code plus the golden files it references) is named for nothing → error.
                fix: use the plain token or matcher; a ref earns its name by asserting equality across two places
                read: docs/reference/linting.md#no-single-use-ref
        `);
    });

    test('stays silent for a plain matcher', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
