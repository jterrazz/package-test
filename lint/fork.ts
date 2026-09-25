import { cell, table } from './catalog.js';

/** Generated into chapter 18, the one page that states it. */

export const FORK_START =
    '<!-- GENERATED:fork — do not edit by hand; run `npm run docs`. Source: lint/fork.ts -->';
export const FORK_END = '<!-- /GENERATED:fork -->';

type ForkRow = {
    constructor: string;
    kind: string;
    livesAt: string;
    project: string;
    question: string;
};

/** The order is the decision: a rendered page is a website spec though it also answers HTTP. */
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
        constructor: '`specification.job()`',
        kind: 'job',
        livesAt: '`specs/job/<job>/<aspect>.spec.ts`',
        project: '`job`',
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
