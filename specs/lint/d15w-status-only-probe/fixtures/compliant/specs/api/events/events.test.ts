import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

describe('events', () => {
test('creates an event', () => {
    // Given - an API result
    const result = call();

    // Then - the status probe sits alongside a full-response golden: scalpel, silent
    expect(result.status).toBe(201);
    expect(result.response).toMatch(file('./expected/created.http')); // checker-disable-line c28 -- an input tree of the d15w-status-only-probe spec: its file form is what the rule reads
});
});
