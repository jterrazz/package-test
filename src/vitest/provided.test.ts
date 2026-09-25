import { describe, expect, test } from 'vitest';

import { routesLedger } from './provided.js';

describe('provided', () => {
    test('a run whose global setup provides no ledger measures no route coverage', async () => {
        // Given - the unit project, which declares no route-coverage setup
        const ledger = await routesLedger();

        // Then - no folder to write a ledger into
        expect(ledger).toBeUndefined();
    });
});
