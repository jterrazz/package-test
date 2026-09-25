import { BaseResult } from '../../expectations/result.js';
import { defineAction } from '../../kernel/chain/action.js';
import type { ChainSignature } from '../../kernel/chain/capability.js';
import type { Job } from './job.handle.js';
import type { JobResult } from './job.result.js';

/** The jobs a chain may trigger — the `jobs` option of `specification.job()`, as started. */
export type JobsPort = readonly Job[];

/** What `.trigger()` puts on a chain. */
export type TriggerSignature = ChainSignature & {
    readonly chain: {
        /** Execute the named job registered via the `jobs` option and resolve with the result. */
        trigger: (name: string) => Promise<JobResult>;
    };
};

/**
 * `.trigger(name)`: run the named job in this process and resolve with what
 * reads its effects — the databases, never a working directory.
 */
export const trigger = defineAction<
    'trigger',
    [name: string],
    BaseResult,
    TriggerSignature,
    { jobs: JobsPort }
>({
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
});
