import { expect, test } from 'vitest';

test('creates an event', () => {
    // Given - an API result
    const result = call();

    // Then - the status probe sits alongside a full-response golden: scalpel, silent
    expect(result.status).toBe(201);
    expect(result.response).toMatch('created.http');
});
