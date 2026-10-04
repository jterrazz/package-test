import { defineAction } from '../../chain/action.js';
import type { ChainSignature } from '../../chain/capability.js';
import { refusal } from '../../chain/refusals/refusal.js';
import { BaseResult } from '../../expectations/result.js';
import type { Job } from './job.handle.js';
import type { JobResult } from './job.result.js';

type Needs = { jobs: readonly Job[] };

export type TriggerSignature = ChainSignature & {
    readonly chain: {
        /** Execute the named job registered via the `jobs` option and resolve with the result. */
        trigger: (name: string) => Promise<JobResult>;
    };
};

export const trigger = defineAction<'trigger', [name: string], BaseResult, TriggerSignature, Needs>(
    {
        accessors: [
            { group: 'Result accessor', member: 'table', name: '.table()', probe: 'result.table(' },
        ],
        name: 'trigger',
        perform: async ([name], _read, { jobs }, { config, testDir }) => {
            if (jobs.length === 0) {
                throw new Error(
                    refusal({
                        fix: 'register the jobs with the `jobs` option of specification.job()',
                        found: `.trigger("${name}"), and no job is registered`,
                        read: 'docs/guides/job-specs.md#options',
                        why: 'A job is triggered by the name it is registered under.',
                    }),
                );
            }
            const job = jobs.find((candidate) => candidate.name === name);
            if (job === undefined) {
                const available = jobs.map((candidate) => candidate.name).join(', ');
                throw new Error(
                    refusal({
                        fix: `trigger a registered job: ${available}`,
                        found: `.trigger("${name}"), and no job is registered under that name`,
                        read: 'docs/guides/job-specs.md#options',
                        why: 'A job is triggered by the name it is registered under.',
                    }),
                );
            }
            await job.execute();
            return new BaseResult({ config, testDir });
        },
        row: { group: 'Terminal action', name: '.trigger()', probe: ".trigger('" },
    },
);
