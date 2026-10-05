import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-repeated-chain-setting', () => {
    test("two chains pinning two instants state two conditions, not the file's", async () => {
        // Given - the apart tree
        const result = await lint.fixture(directory('./_fixtures/apart/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a clock every chain of a file pins alike is refused at the first chain', async () => {
        // Given - the repeated tree
        const result = await lint.fixture(directory('./_fixtures/repeated/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/events/list/pagination.spec.ts:8:30  jterrazz(no-repeated-chain-setting)
                found: all 2 chains of this file state \`.clock('2026-03-04T09:30:00Z')\` alike
                why: A setting every chain of a spec file states alike — the same \`.clock(…)\`, the same \`.headers(…)\`, the same \`.env(…)\`, per runner handle — is the file’s, stated once on a view of the specification: \`const events = api.with({ clock: '…' })\` → error at the first chain.
                fix: state it once for the file — \`const events = api.with({ clock: '2026-03-04T09:30:00Z' })\` — and start every chain from \`events\`; \`typescript fix\` writes it
                read: docs/reference/linting.md#no-repeated-chain-setting
        `);
    });
});
