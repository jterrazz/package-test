import { relative } from 'node:path';

import { safeRealpath } from '../../../../lint/engine/project/resolve.js';
import { defineAction } from '../../../chain/action.js';
import type { ChainSignature } from '../../../chain/capability.js';
import { scratchDirectory } from '../../../chain/paths/scratch.js';
import { resolveSpecPath } from '../../../disk/resolved-spec-path.js';
import { requireDiskFile } from '../../../disk/spec-path.js';
import type { DiskFile } from '../../../disk/spec-path.js';
import { CLI_RESULT_ROWS } from '../../../expectations/command/cli.result.js';
import type { CliResult } from '../../../expectations/command/cli.result.js';
import type { CliConfig } from '../cli.handle.js';
import { env as chainEnv, childEnv } from '../process/env.capability.js';
import { runSpecDocument } from './literate.js';
import type { LiterateRunFlags } from './literate.js';

export type RunSignature = ChainSignature & {
    readonly chain: {
        /** Run a `<case>.spec.yaml` document and resolve with the last run's result. */
        run: (document: DiskFile<'.spec.yaml'>, options?: LiterateRunFlags) => Promise<CliResult>;
    };
};

/** The chain's fixture is laid first, the document's `fixture:` over it; its `env:` wins over a chained `.env()`. */
export const run = defineAction<
    'run',
    [document: DiskFile<'.spec.yaml'>, options?: LiterateRunFlags],
    CliResult,
    RunSignature,
    Record<never, never>,
    CliConfig
>({
    accessors: CLI_RESULT_ROWS,
    name: 'run',
    perform: async ([document, options], read, _adapters, { config, testDir, workDir }) => {
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
    row: { group: 'Terminal action', name: '.run()', probe: '.run(' },
});
