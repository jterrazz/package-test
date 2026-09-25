import { relative } from 'node:path';

import { env as chainEnv, childEnv } from '../../capabilities/env/env.capability.js';
import { defineAction } from '../../model/chain/action.js';
import { resolveSpecPath, safeRealpath } from '../../model/chain/resolve.js';
import { scratchDirectory } from '../../model/chain/scratch.js';
import { requireDiskFile } from '../../model/chain/spec-path.js';
import type { DiskFile } from '../../model/chain/spec-path.js';
import { CLI_RESULT_ROWS } from '../../results/cli.result.js';
import type { CliResult } from '../../results/cli.result.js';
import { runSpecDocument } from './literate.js';
import type { LiterateRunFlags } from './literate.js';

/**
 * `.run(file('./<case>.spec.yaml'))`: run a document — its ground and every
 * run, each asserted, in ONE working directory — and resolve with the LAST
 * run's result. What the chain states lies underneath the document's own
 * ground: a chained fixture is laid first, the document's `fixture:` over it,
 * and its `env:` wins over a chained `.env()`.
 */
export const run = defineAction<
    'run',
    [document: DiskFile<'.spec.yaml'>, options?: LiterateRunFlags],
    CliResult
>({
    accessors: CLI_RESULT_ROWS,
    name: 'run',
    perform: async ([document, options], read, _engines, { config, testDir, workDir }) => {
        // oxlint-disable-next-line typescript/no-non-null-assertion -- `prepare` always answers a directory: a document never runs in the source tree
        const cwd = workDir!;
        const filePath = resolveSpecPath('run', document.path, testDir);
        return await runSpecDocument({
            baseEnv: childEnv(config, read(chainEnv), safeRealpath(cwd)),
            config,
            displayPath: relative(process.cwd(), filePath) || document.path,
            filePath,
            frozen: options?.frozen,
            testDir,
            workDir: cwd,
        });
    },
    prepare: ([document]) => {
        requireDiskFile('run', document, '.spec.yaml');
        return { workDir: scratchDirectory('spec-command-') };
    },
    row: { group: 'Terminal action', name: '.run()', probe: '.run(file(' },
});
