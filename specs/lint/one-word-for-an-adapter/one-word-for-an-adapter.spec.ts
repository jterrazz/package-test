import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as self } from '../self-lint.specification.js';

describe('one-word-for-an-adapter', () => {
    test('a module adapting the clock, named `*.adapter.ts` for what it adapts, passes', async () => {
        // Given - the adapters tree
        const result = await self.fixture(directory('./_fixtures/adapters/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a module adapting the clock named `*.driver.ts` is refused at its first line', async () => {
        // Given - the drivers tree
        const result = await self.fixture(directory('./_fixtures/drivers/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/clock/clock.driver.ts:1:1  jterrazz-check(one-word-for-an-adapter)
                found: \`clock.driver.ts\` carries the suffix \`.driver\`, a second word for an adapter
                why: A module of \`src/\` that implements a port — the clock of a process or of a page, a page, a device, the disk — is an adapter, and carries the one suffix \`*.adapter.ts\`, named for what it adapts (\`process-clock.adapter.ts\`, \`page-clock.adapter.ts\`).
                fix: rename it \`<what it adapts>.adapter.ts\` — the process clock's is \`process-clock.adapter.ts\` — and the paths that import it
                read: docs/guides/test.md#one-word-for-an-adapter
        `);
    });
});
