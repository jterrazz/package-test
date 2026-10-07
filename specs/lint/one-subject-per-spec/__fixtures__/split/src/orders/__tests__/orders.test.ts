import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/** The seed the orders stand on, named from this module test. */
const SEED = resolve(import.meta.dirname, '../../../specs/api/orders/__seeds__/one-order.sql');

describe('orders', () => {
test('names the seed', () => {
    // Given - the seed's path
    // Then - it is named
    expect(SEED).toContain('one-order');
});
});
