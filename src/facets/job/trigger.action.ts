import { BaseResult } from '../../expectations/result.js';
import { defineAction } from '../../kernel/chain/action.js';
import type { ChainSignature } from '../../kernel/chain/capability.js';
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
                    'Job actions require jobs registered via the jobs option of specification.job()',
                );
            }
            const job = jobs.find((candidate) => candidate.name === name);
            if (job === undefined) {
                const available = jobs.map((candidate) => candidate.name).join(', ');
                throw new Error(`trigger("${name}"): job not found. Available: ${available}`);
            }
            await job.execute();
            return new BaseResult({ config, testDir });
        },
        row: { group: 'Terminal action', name: '.trigger()', probe: ".trigger('" },
    },
);
