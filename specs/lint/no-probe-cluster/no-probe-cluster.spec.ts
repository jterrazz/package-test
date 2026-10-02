import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-probe-cluster', () => {
    test('accepts two targeted probes', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects three probes on one stream with no golden', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            scenario.test.ts:6:1  jterrazz(no-probe-cluster)
                found: 3 probes on \`result.stdout\`
                why: Three probes (\`threshold\`, default 3) on one goldenable subject — \`stdout\`, \`stderr\`, \`content\`, \`head\`, \`meta()\`, \`canonical\`, \`alternates\`, \`tree\`, \`html\` — with no \`toMatch(file(…))\` on it is an error.
                fix: compare it whole — \`\`expect(result.stdout).toMatch(\`…\`)\`\`, \`TEST_UPDATE=1\` writing the value — with tokens for what moves
                read: docs/19-linting.md#no-probe-cluster
        `);
    });
});
