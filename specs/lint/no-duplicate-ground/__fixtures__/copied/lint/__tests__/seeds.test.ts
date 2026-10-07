import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/** The two copies, named from this module test — each form a path takes. */
const USERS = resolve(import.meta.dirname, '../../specs/api/users/__seeds__/two-users.sql');
const ORDERS = new URL('../../specs/api/orders/__seeds__/two-users.sql', import.meta.url);

describe('seeds', () => {
test('names the seed twice', () => {
    // Given - the two paths
    // Then - they end on the same name
    expect(ORDERS.pathname.endsWith(USERS.slice(-'two-users.sql'.length))).toBe(true);
});
});
