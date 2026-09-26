import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

describe('events', () => {
test('creates an event', () => {
    // Given - an API result
    const result = call();

    // Then - the status probe sits alongside a full-response golden: scalpel, silent
    expect(result.status).toBe(201);
    expect(result.response).toMatch(file('./_expected/created.http')); // checker-disable-line ground-shared-or-inline -- an input tree of the no-status-only-test spec: its file form is what the rule reads
});
});
