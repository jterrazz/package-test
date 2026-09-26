import { resolve } from 'node:path';

import {
    BASELINE_FILE,
    raised,
    readBaseline,
    readSummary,
    report,
    SUMMARY_FILE,
    writeBaseline,
} from '../baseline/coverage.js';
import type { CoverageMetrics } from '../baseline/coverage.js';
import { stop } from './stop.js';

/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a gate that wrote anywhere else would be reporting to nobody. */

export type CoverageJudge = (
    floor: CoverageMetrics | undefined,
    now: CoverageMetrics,
    scope: string,
) => string[];

/** `--write` records; `--scope <name>` keeps one project's floor apart. Neither runs the suite: they read the last `--coverage` report, or a second run could disagree with the first. */
export function runCoverageFloor(judge: CoverageJudge, cliArguments: readonly string[]): never {
    const write = cliArguments.includes('--write');
    const scopeFlag = cliArguments.indexOf('--scope');
    const scope = scopeFlag === -1 ? 'all' : (cliArguments[scopeFlag + 1] ?? 'all');
    const root = resolve('.');

    const now = readSummary(root);
    if (now === null) {
        console.error(
            `coverage: no report at ${SUMMARY_FILE} — run \`npx vitest --run --coverage\` first.`,
        );
        stop(1);
    }
    const baseline = readBaseline(root);
    const floor = baseline[scope];
    if (write) {
        const next = raised(floor, now);
        writeBaseline(root, { ...baseline, [scope]: next });
        console.log(`coverage: ${report(scope, next)} → ${BASELINE_FILE}`);
        stop(0);
    }
    console.log(`coverage: ${report(scope, now)}`);
    const refusals = judge(floor, now, scope);
    for (const line of refusals) {
        console.error(`coverage: ${line}`);
    }
    stop(refusals.length > 0 ? 1 : 0);
}
