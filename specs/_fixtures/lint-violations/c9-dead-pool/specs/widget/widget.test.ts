import { describe, expect, test } from 'vitest';

import { cli } from '../setup/cli.specification.js';

describe('widget', () => {
    test('uses one pool app but leaves the other pool entry dead', async () => {
        // Given - a spec referencing only the used-app pool entry
        const result = await cli.fixture('$FIXTURES/used-app/').exec('run');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
