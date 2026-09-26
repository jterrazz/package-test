import { describe, expect, test } from 'vitest';

describe('events', () => {
test('rejects an invalid payload', () => {
    // Given - an API result
    const result = call();

    // Then - the test's only assertion is a lone status probe (`no-status-only-test` warn)
    expect(result.status).toBe(422);
});
});
