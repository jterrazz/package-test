import { describe, expect, test } from 'vitest';

import { trigger } from './trigger.action.js';

const RUN = { config: {}, testDir: '/specs/job', workDir: null };

const unread = <Slice>(capability: { readonly initial: Slice }): Slice => capability.initial;

describe('trigger', () => {
    test('.trigger() — the job a chain runs — a runner that registered no job says where jobs are registered', async () => {
        // Given - a job runner handed an empty list

        // Then - the refusal names the option, rather than listing no job as "available"
        await expect(
            trigger.perform(['report-refresh'], unread, { jobs: [] }, RUN),
        ).rejects.toThrow(
            'Job actions require jobs registered via the jobs option of specification.job()',
        );
    });
});
