import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { importSourceVisitor } from '../../../engine/project/ast.js';
import type { Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import type { FileRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** A group's message is its fix: a ban with no destination is an argument. */
type Group = {
    fix: string;
    matches: (source: string) => boolean;
    roles?: FileRole[];
};

const GROUPS: Group[] = [
    {
        fix: '`component.render()` and the element vocabulary render in a real browser — the queries are the same nouns, and they run against what ships',
        matches: (source) =>
            source === '@testing-library' || source.startsWith('@testing-library/'),
    },
    {
        fix: 'a drawing of a browser proves what a browser does not — a rendered thing is a `.test.tsx` beside its component, collected by `component()`',
        matches: (source) => source === 'happy-dom' || source === 'jsdom',
    },
    {
        fix: 'Browser Mode is the seam, not the surface — `component.render()` owns the locators, the visitor and the ARIA tree',
        matches: (source) =>
            source === 'vitest/browser' ||
            source.startsWith('vitest-browser-') ||
            source.startsWith('@vitest/browser'),
    },
    {
        fix: 'the network answers through stubs — `await using _ = await intercept(defineStubs(…))` in module scope, `.intercept()` on a chain',
        matches: (source) => source === 'msw' || source.startsWith('msw/') || source === 'nock',
    },
    {
        fix: 'the doubles ladder is closed — `mockOf<Port>()` for an injected interface, `vi.fn()` for a function, `vi.spyOn` for an object the test passes in',
        matches: (source) => source === 'sinon' || source === 'vitest-mock-extended',
    },
    {
        fix: 'vitest is the runner this vocabulary speaks — `test`, `expect` and `vi` come from it',
        matches: (source) => source === 'jest' || source.startsWith('@jest/'),
    },
    {
        fix: 'time is one primitive — `using _ = clock.at(iso)` pins the calendar and gives it back at the end of the scope',
        matches: (source) => source === 'mockdate',
    },
    {
        fix: 'the website facet drives the browser — `specification.website()` owns the page, and the peer is its',
        matches: (source) =>
            source === 'playwright' ||
            source === 'playwright-core' ||
            source === '@playwright/test',
    },
    {
        fix: 'the mobile facet drives the simulator — `specification.mobile()` owns the session, and the peers are its',
        matches: (source) => source === 'webdriverio' || source === 'appium',
    },
    {
        fix: 'a component rendered to a string is still a component — the test is a `.test.tsx` beside it, and `result.html` carries the markup',
        matches: (source) => source === 'react-dom/server',
        roles: ['module'],
    },
];

/** A fixture project's own config must name the provider, and a `providers.tsx` must import the adapter it wraps. */
const REACHED = new Set<FileRole>(['component', 'module', 'spec', 'specification']);

/** `react-dom/server` alone has a role of its own: in a `.test.tsx` rendering to a string is legitimate. */
export const noSecondTestRuntime: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            ...importSourceVisitor(({ node, source }) => {
                const { role } = identityOf(context);
                const group = GROUPS.find(
                    (candidate) =>
                        candidate.matches(source) &&
                        (candidate.roles === undefined || candidate.roles.includes(role)),
                );
                if (group !== undefined) {
                    context.report({
                        data: { fix: group.fix, source },
                        messageId: 'foreignRuntime',
                        node,
                    });
                }
            }),
            before: () => REACHED.has(identityOf(context).role),
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'no-second-test-runtime'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'no-second-test-runtime'),
            {
                foreignRuntime: {
                    found: '`{{source}}` is a second test runtime in a test file',
                    fix: '{{fix}}',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
