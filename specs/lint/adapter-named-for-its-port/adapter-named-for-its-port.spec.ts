import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('adapter-named-for-its-port', () => {
    test('a test adapter named <port>.adapter.ts passes, however its class or its import is named', async () => {
        // Given - the named tree
        const result = await checker.fixture(directory('./_fixtures/named/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a test adapter named for its class rather than the port it implements is refused at the class', async () => {
        // Given - the misnamed tree
        const result = await checker.fixture(directory('./_fixtures/misnamed/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/_setup/fixed-ticker.ts:3:1  jterrazz-check(adapter-named-for-its-port)
                found: \`fixed-ticker.ts\`, whose \`FixedTickerSource\` implements the port \`TickerSourcePort\`
                why: A \`_setup/\` module whose class \`implements\` a type it imports from outside the specs tree — the application’s port — is a test adapter, and its file is named for that port: \`<port>.adapter.ts\`, the port’s name kebab-cased with a trailing \`Port\` dropped (\`TickerSourcePort\` → \`ticker-source.adapter.ts\`); the class keeps whatever name it has.
                fix: name the file for the port it replaces: \`specs/cli/_setup/ticker-source.adapter.ts\` — the class keeps whatever name it has
                read: docs/19-linting.md#adapter-named-for-its-port
            specs/cli/_setup/frozen-clock.ts:3:1  jterrazz-check(adapter-named-for-its-port)
                found: \`frozen-clock.ts\`, whose \`FrozenClock\` implements the port \`ClockPort\`
                why: A \`_setup/\` module whose class \`implements\` a type it imports from outside the specs tree — the application’s port — is a test adapter, and its file is named for that port: \`<port>.adapter.ts\`, the port’s name kebab-cased with a trailing \`Port\` dropped (\`TickerSourcePort\` → \`ticker-source.adapter.ts\`); the class keeps whatever name it has.
                fix: name the file for the port it replaces: \`specs/cli/_setup/clock.adapter.ts\` — the class keeps whatever name it has
                read: docs/19-linting.md#adapter-named-for-its-port
        `);
    });
});
