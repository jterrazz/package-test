import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('captures', () => {
    test('a ref captured on stdout holds on the same result’s stderr', async () => {
        // Given - a command writing one session id to both streams, captured on stdout
        const result = await cli.fixture(directory('../_fixtures/specimen-cli/')).exec('session');
        expect(result.stdout).toMatch(`
            session {{uuid#session}}
        `);

        // Then - stderr is compared within the same capture scope, and the ref holds
        expect(result.stderr).toMatch(`
            session {{uuid#session}}
        `);
    });

    test('a ref captured on stdout refuses another value on the same result’s stderr', async () => {
        // Given - a command writing a different session id to each stream, captured on stdout
        const result = await cli
            .fixture(directory('../_fixtures/specimen-cli/'))
            .exec('two-sessions');
        expect(result.stdout).toMatch(`
            session {{uuid#session}}
        `);

        // Then - stderr's id is held to the one stdout captured, and the comparison fails on it
        expect(() => {
            expect(result.stderr).toMatch(
                `
                session {{uuid#session}}
            `,
                { frozen: true },
            );
        }).toThrow('Output mismatch (the value in place)');
    });

    test('a ref captured on one result never constrains another result’s stderr', async () => {
        // Given - two runs, each writing its own session id, the first captured on stdout
        const first = await cli.fixture(directory('../_fixtures/specimen-cli/')).exec('session');
        const second = await cli.fixture(directory('../_fixtures/specimen-cli/')).exec('session');
        expect(first.stdout).toMatch(`
            session {{uuid#session}}
        `);

        // Then - the second result's stderr captures afresh
        expect(second.stderr).toMatch(`
            session {{uuid#session}}
        `);
    });
});
