import { cell, table } from './catalog.js';

/**
 * The fork — the nine questions a test answers before it is written, in the
 * order they are asked, and everything the first yes fixes: the kind, where the
 * file lives, the constructor, the project. Generated into chapter 18, the
 * constitution, which is the one page that states it.
 */

/** Markers delimiting the generated fork table inside `docs/18-conventions.md`. */
export const FORK_START =
    '<!-- GENERATED:fork — do not edit by hand; run `npm run docs`. Source: lint/fork.ts -->';
export const FORK_END = '<!-- /GENERATED:fork -->';

/** One row of the fork: the question, and everything its answer fixes. */
type ForkRow = {
    constructor: string;
    kind: string;
    livesAt: string;
    project: string;
    question: string;
};

/**
 * The fork, in the order the questions are asked. The order is the decision:
 * a rendered page is a website spec even though it also answers HTTP, and a
 * module alone is the last row because every other question failed.
 */
export const FORK: ForkRow[] = [
    {
        constructor: '`specification.website()`',
        kind: 'website',
        livesAt: '`specs/website/<domain>/<aspect>.spec.ts`',
        project: '`website`',
        question: 'Does it render in a browser as a whole served page?',
    },
    {
        constructor: 'none — the `component` chain',
        kind: 'component',
        livesAt: '`<file>.test.tsx` beside `<file>.tsx`',
        project: '`component`',
        question: 'Does it render as a component (React, a DOM function, a hook)?',
    },
    {
        constructor: '`specification.mobile()`',
        kind: 'mobile',
        livesAt: '`specs/mobile/<domain>/<aspect>.spec.ts`',
        project: '`mobile`',
        question: 'Does it render on a simulator?',
    },
    {
        constructor: '`specification.api()`',
        kind: 'api',
        livesAt: '`specs/api/<resource>/<action>/<aspect>.spec.ts`',
        project: '`api`',
        question: 'Does it answer HTTP?',
    },
    {
        constructor: '`specification.jobs()`',
        kind: 'jobs',
        livesAt: '`specs/jobs/<job>/<aspect>.spec.ts`',
        project: '`jobs`',
        question: 'Is it triggered by name, in-process?',
    },
    {
        constructor: '`specification.cli(bin)`',
        kind: 'cli',
        livesAt: '`specs/cli/<command>/` (+ `<case>.spec.yaml`)',
        project: '`cli`',
        question: 'Is it a binary?',
    },
    {
        constructor: '`specification.integration()`',
        kind: 'integration',
        livesAt: '`specs/integration/<domain>/<aspect>.spec.ts`',
        project: '`integration`',
        question: 'Is it a module that needs a real service, or whose oracle is a golden?',
    },
    {
        constructor: 'none',
        kind: 'module',
        livesAt: '`<file>.test.ts` beside `<file>.ts`',
        project: '`unit`',
        question: 'Is it a module alone?',
    },
    {
        constructor: 'none',
        kind: 'repository suite',
        livesAt: '`specs/<family>/<aspect>.test.ts`',
        project: 'any name',
        question: 'Is it the repository itself — a suite over several apps?',
    },
];

/** The fork table itself. */
function forkTable(): string[] {
    return table(
        ['Question', 'Kind', 'Lives at', 'Constructor', 'Project'],
        FORK.map((row) => [
            cell(row.question),
            row.kind,
            cell(row.livesAt),
            cell(row.constructor),
            cell(row.project),
        ]),
    );
}

/** Replace the region between the GENERATED markers of chapter 18 with a fresh fork table. */
export function spliceFork(existing: string): string {
    const start = existing.indexOf(FORK_START);
    const end = existing.indexOf(FORK_END);
    if (start === -1 || end === -1) {
        throw new Error(
            `docs/18-conventions.md is missing the GENERATED:fork markers (${FORK_START} … ${FORK_END})`,
        );
    }
    const inner = [FORK_START, '', ...forkTable(), '', FORK_END].join('\n');
    return existing.slice(0, start) + inner + existing.slice(end + FORK_END.length);
}
