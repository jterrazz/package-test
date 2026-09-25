import { intercept } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { rates } from './contracts/rates.contracts.js';
import { eurRate } from './rates.js';

test('reads the rate off the provider', async () => {
    // Given - the provider's rates
    await using _ = await intercept(rates);

    // Then - the module answers with the rate served
    await expect(eurRate()).resolves.toBe(1.07);
});
