import { cell, markdownTable } from '@jterrazz/typescript/rules';
import type { Markers } from '@jterrazz/typescript/rules';

export const FORK_CHAPTER = 'docs/start/getting-started.md';

export const FORK_MARKERS: Markers = {
    end: '<!-- /GENERATED:fork -->',
    start: '<!-- GENERATED:fork. Do not edit by hand; run `npm run docs`. Source: lint/consumer/catalogue/fork.ts -->',
};

type ForkRow = {
    constructor: string;
    kind: string;
    livesAt: string;
    project: string;
    question: string;
    read: string;
};

/** The order is the decision: a rendered page is a website spec though it also answers HTTP. */
export const FORK: ForkRow[] = [
    {
        constructor: '`specification.website()`',
        kind: 'website',
        livesAt: '`specs/website/<domain>/<aspect>.spec.ts`',
        project: '`website`',
        question: 'Does it render in a browser as a whole served page?',
        read: '[Website specs](../guides/website-specs.md)',
    },
    {
        constructor: 'none, the `component` chain',
        kind: 'component',
        livesAt: '`__tests__/<file>.test.tsx` by `<file>.tsx`',
        project: '`component`',
        question: 'Does it render as a component (React, a DOM function, a hook)?',
        read: '[Component specs](../guides/component-specs.md)',
    },
    {
        constructor: '`specification.mobile()`',
        kind: 'mobile',
        livesAt: '`specs/mobile/<domain>/<aspect>.spec.ts`',
        project: '`mobile`',
        question: 'Does it render on a simulator?',
        read: '[Mobile specs](../guides/mobile-specs.md)',
    },
    {
        constructor: '`specification.api()`',
        kind: 'api',
        livesAt: '`specs/api/<resource>/<action>/<aspect>.spec.ts`',
        project: '`api`',
        question: 'Does it answer HTTP, in this process or deployed at a url?',
        read: '[API specs](../guides/api-specs.md)',
    },
    {
        constructor: '`specification.job()`',
        kind: 'job',
        livesAt: '`specs/job/<job>/<aspect>.spec.ts`',
        project: '`job`',
        question: 'Is it triggered by name, in-process?',
        read: '[Job specs](../guides/job-specs.md)',
    },
    {
        constructor: '`specification.cli(bin)`',
        kind: 'cli',
        livesAt: '`specs/cli/<command>/` (+ `<case>.spec.yaml`)',
        project: '`cli`',
        question: 'Is it a binary?',
        read: '[CLI specs](../guides/cli-specs.md), [Spec documents](../guides/spec-documents.md)',
    },
    {
        constructor: '`specification.lint()`',
        kind: 'lint',
        livesAt: '`specs/lint/<rule>/<aspect>.spec.ts`',
        project: '`lint`',
        question: 'Is it a rule the project ships: a plugin, a checker, a preset?',
        read: '[Lint specs](../guides/lint-specs.md)',
    },
    {
        constructor: '`specification.integration()`',
        kind: 'integration',
        livesAt: '`specs/integration/<domain>/<aspect>.spec.ts`',
        project: '`integration`',
        question: 'Is it a module that needs a real service, or whose oracle is a golden?',
        read: '[Integration specs](../guides/integration-specs.md)',
    },
    {
        constructor: 'none',
        kind: 'module',
        livesAt: '`__tests__/<file>.test.ts` by `<file>.ts`',
        project: '`unit`',
        question: 'Is it a module alone?',
        read: '[Module tests](../guides/module-tests.md)',
    },
    {
        constructor: 'none',
        kind: 'repository suite',
        livesAt: '`specs/<suite>/<domain>/<aspect>.test.ts`',
        project: 'any name',
        question: 'Is it the repository itself, a suite over several apps?',
        read: '[Conventions § The third door](../concepts/conventions.md#the-third-door-a-repository-suite)',
    },
];

export function forkTable(): string {
    return markdownTable(
        ['Question', 'Kind', 'Lives at', 'Constructor', 'Project', 'Read'],
        FORK.map((row) => [
            cell(row.question),
            row.kind,
            cell(row.livesAt),
            cell(row.constructor),
            cell(row.project),
            row.read,
        ]),
    );
}
