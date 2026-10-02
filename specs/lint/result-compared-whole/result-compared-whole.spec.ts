import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('result-compared-whole', () => {
    test('a result read only for the cursor the next request sends owes no comparison', async () => {
        // Given - the cursor-carried tree
        const result = await lint.fixture(directory('./_fixtures/cursor-carried/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a precise assertion beside the whole comparison passes', async () => {
        // Given - the whole-and-probe tree
        const result = await lint.fixture(directory('./_fixtures/whole-and-probe/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a carried value also claimed is a read, and a later result only probed is refused', async () => {
        // Given - the cursor-claimed tree
        const result = await lint.fixture(directory('./_fixtures/cursor-claimed/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/facts/pagination.spec.ts:17:31  jterrazz(result-compared-whole)
                found: the test reads first.response and never compares it whole
                why: A test that reads a response, a json or a table — \`<result>.response\`, \`<result>.json\`, \`<result>.table('<name>')\` of a result it awaited — compares it WHOLE, once: \`toMatch\` handed the whole result written in place or its golden, or a table's \`toBeEmpty()\`.
                fix: add \`\`expect(first.response).toMatch(\`…\`)\`\` with the whole result in place (\`TEST_UPDATE=1\` fills an empty one); a precise assertion stays beside it
                read: docs/19-linting.md#result-compared-whole
            specs/api/facts/pagination.spec.ts:35:12  jterrazz(result-compared-whole)
                found: the test reads second.json and never compares it whole
                why: A test that reads a response, a json or a table — \`<result>.response\`, \`<result>.json\`, \`<result>.table('<name>')\` of a result it awaited — compares it WHOLE, once: \`toMatch\` handed the whole result written in place or its golden, or a table's \`toBeEmpty()\`.
                fix: add \`\`expect(second.json).toMatch(\`…\`)\`\` with the whole result in place (\`TEST_UPDATE=1\` fills an empty one); a precise assertion stays beside it
                read: docs/19-linting.md#result-compared-whole
        `);
    });

    test('a test probing its response and never comparing it whole is refused at the read', async () => {
        // Given - the probe-alone tree
        const result = await lint.fixture(directory('./_fixtures/probe-alone/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/users/listed.spec.ts:11:12  jterrazz(result-compared-whole)
                found: the test reads result.response and never compares it whole
                why: A test that reads a response, a json or a table — \`<result>.response\`, \`<result>.json\`, \`<result>.table('<name>')\` of a result it awaited — compares it WHOLE, once: \`toMatch\` handed the whole result written in place or its golden, or a table's \`toBeEmpty()\`.
                fix: add \`\`expect(result.response).toMatch(\`…\`)\`\` with the whole result in place (\`TEST_UPDATE=1\` fills an empty one); a precise assertion stays beside it
                read: docs/19-linting.md#result-compared-whole
        `);
    });
});
