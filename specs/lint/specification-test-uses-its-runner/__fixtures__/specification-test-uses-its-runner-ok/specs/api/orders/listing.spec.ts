import { describe, expect, test } from 'vitest'; // checker-disable-line spec-in-subject-folder -- an input of specification-test-uses-its-runner: this folder is the case the rule reads, not a subject's standard name

// The import states no extension: the runner is reached by the MODULE it
// names, and a scan for `.specification.js` read this spec as a module test.
import { api } from '../api.specification';

describe('listing', () => {
test('answers the orders of the day', async () => {
    // Given - two orders placed today
    const result = await api.get('/orders');
    // Then - the response lists them both
    expect(result.status).toBe(200);
    expect(result.response.body).toContain('2'); // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the checker spec: the probe is incidental to the rule it feeds
});
});
