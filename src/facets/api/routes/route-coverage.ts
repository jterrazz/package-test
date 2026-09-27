import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

import { refusal } from '../../../../lint/index.refusal.js';
import { shouldUpdateSnapshots } from '../../../expectations/in-place/update.js';
import { setupEntry } from '../../../kernel/files/setup-entry.js';
import { clearLedgers, markPartial, ROUTES_DIR, shardLedgersDir } from './ledger.js';
import type { Shard } from './ledger.js';
import { judgeRoutes } from './route-judge.js';
import type { RunScope } from './route-judge.js';

/** Judged only on a whole green run: a shard, a `-t` filter, `--changed` or a failed file is no count. The ratchet is exact both ways; an app with no known route table fails the run. */

export type RouteProject = {
    config: { root: string };
    globTestFiles: () => Promise<{ testFiles: string[] }>;
    name: string;
    provide: (key: 'routesLedger', value: string) => void;
    vitest: {
        config: { shard?: Shard | undefined; testNamePattern?: RegExp | undefined };
        state: {
            getFailedFilepaths: () => string[];
            getFiles: () => readonly { filepath: string; projectName?: string | undefined }[];
        };
    };
};

async function scopeOf(project: RouteProject): Promise<RunScope> {
    if (project.vitest.config.shard !== undefined) {
        return 'shard';
    }
    if (project.vitest.config.testNamePattern !== undefined) {
        return 'partial';
    }
    const ran = new Set(
        project.vitest.state
            .getFiles()
            .filter((file) => file.projectName === project.name)
            .map((file) => file.filepath),
    );
    const { testFiles } = await project.globTestFiles();
    return testFiles.every((file) => ran.has(file)) ? 'whole' : 'partial';
}

export function routeCoverageSetup(): string {
    return setupEntry(import.meta.dirname, 'route-coverage.ts', 'route-coverage.js');
}

export function setupRoutes(project: RouteProject): () => Promise<void> {
    const { root } = project.config;
    const shard: Shard | undefined = project.vitest.config.shard;
    const directory = join(root, shard === undefined ? ROUTES_DIR : shardLedgersDir(shard));
    clearLedgers(directory);
    if (shard !== undefined && project.vitest.config.testNamePattern !== undefined) {
        markPartial(directory);
    }
    project.provide('routesLedger', directory);
    return async () => {
        const { failure, line } = await judgeRoutes(root, directory, {
            failed: project.vitest.state.getFailedFilepaths().length,
            scope: await scopeOf(project),
            update: shouldUpdateSnapshots(),
        });
        if (failure !== undefined) {
            throw new Error(refusal(failure));
        }
        if (line !== undefined) {
            process.stdout.write(`${line}\n`);
        }
    };
}

export default function setup(project: TestProject): () => Promise<void> {
    return setupRoutes(project);
}
