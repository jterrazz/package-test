import { describe, expect, test } from 'vitest';

import { analyticsHandle, job } from '../job.specification.js';

// Jobs run in-process by definition (CONVENTIONS A8) — specification.job()
// Has no mode: the same runner works regardless of TEST_MODE.

describe('crash', () => {
    test('a job that crashes rejects the trigger with its own error, and what it wrote first stays', async () => {
        // Given - a job that writes one row, then throws
        const run = job.trigger('crash-after-insert');

        // Then - the trigger rejects with the job's error, and the row written before stays
        await expect(run).rejects.toThrow('crash-after-insert: boom');
        await expect(
            analyticsHandle.query('events', ['id', 'type', 'payload']),
        ).resolves.toStrictEqual([[1, 'pre_crash', '{}']]);
    });
});
