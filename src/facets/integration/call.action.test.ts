import { describe, expect, test } from 'vitest';

import { call } from './call.action.js';

/** Where the action runs: no databases, no working directory. */
const RUN = { config: {}, testDir: '/specs/orders', workDir: null };

/** A module that refuses whatever it is handed. */
function refuse(): never {
    throw new Error('order 42 is closed');
}

/** A reader no setup of these calls is asked through. */
const unread = <Slice>(capability: { readonly initial: Slice }): Slice => capability.initial;

describe('call', () => {
    test('.call() — the module a chain calls — hands the subject the started services, and reads what it returned', async () => {
        // Given - a services record, and a module that answers with what it was handed
        const services = { db: { url: 'postgres://db' } };

        // When - the module is called
        const result = await call.perform(
            [(started: { db: { url: string } }) => started.db.url],
            unread,
            { services },
            RUN,
        );

        // Then - the value is the record's, and nothing was refused
        expect(result.value).toHaveProperty('text', 'postgres://db');
        expect(result.error.text).toBe('');
    });

    test('.call() — the module a chain calls — a module that throws resolves, its refusal the reading', async () => {
        // Given - a module that refuses

        // When - it is called
        const result = await call.perform([refuse], unread, { services: {} }, RUN);

        // Then - the call resolved, the refusal read on `error`
        expect(result.error.text).toBe('order 42 is closed');
    });
});
