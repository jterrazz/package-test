import { labelOf, readCommandLine, refusal } from '@jterrazz/typescript/rules';
import type { Counts, KitCommand } from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';

import {
    COVERAGE_READ,
    COVERAGE_SECTION,
    readFloor,
    readSummary,
    recordFloor,
    report,
    scopeOf,
    SUMMARY_FILE,
} from '../baseline/coverage.js';

export type CoverageJudge = (floor: Counts | undefined, now: Counts, scope: string) => string[];

const say = (line: string): void => {
    process.stdout.write(`${line}\n`);
};

// invariant: neither gesture runs the suite: each reads the last `--coverage` report, so a second run cannot disagree with the first.
export function coverageFloor(judge: CoverageJudge): KitCommand {
    return (args) => {
        const commandLine = readCommandLine(args, ['--scope']);
        const scope = commandLine.value('--scope', 'all');
        const root = resolve('.');
        const now = readSummary(root, scope);
        if (now === null) {
            say(
                refusal({
                    fix: 'run `npx vitest --run --coverage` first, then this gesture',
                    found: `no coverage report at ${SUMMARY_FILE}`,
                    read: COVERAGE_READ,
                    why: 'the floor is judged on the last `--coverage` run, and a run that wrote no report measured nothing',
                }),
            );

            return 1;
        }
        const { floor, problem } = readFloor(root);
        if (problem !== null) {
            say(problem);

            return 1;
        }
        const scoped = scopeOf(floor, scope);
        if (commandLine.has('--write')) {
            const next = recordFloor(root, floor, now);
            say(`coverage: ${report(scope, next)} → ${labelOf(COVERAGE_SECTION)}`);

            return 0;
        }
        say(`coverage: ${report(scope, now)}`);
        const refusals = judge(Object.keys(scoped).length === 0 ? undefined : scoped, now, scope);
        for (const line of refusals) {
            say(`coverage: ${line}`);
        }

        return refusals.length > 0 ? 1 : 0;
    };
}
