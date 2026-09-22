import { importSourceVisitor } from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { roleOf } from '../../role.js';
import type { FileRole } from '../../role.js';
import type { LintRule, RuleContext, Visitor } from '../../types.js';

/**
 * A foreign runtime, and what the framework offers in its place. The message a
 * group carries is its FIX, because a ban with no destination is an argument
 * rather than a rule.
 */
type Group = {
    fix: string;
    matches: (source: string) => boolean;
    /** The roles the group reaches, when it is narrower than the rule's own. */
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
        fix: 'the network answers through contracts — `await using _ = await intercept(defineContracts(…))` in module scope, `.intercept()` on a chain',
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

/**
 * The roles that RUN a test — never a fixture app's config or a provider module
 * that happens to sit under `specs/`. A fixture project's own `vitest.config.ts`
 * has to name the provider, and a `providers.tsx` has to import the adapter it
 * wraps: neither is a spec speaking a second dialect.
 */
const REACHED = new Set<FileRole>(['component', 'module', 'spec', 'specification']);

/**
 * CONVENTIONS F6 — a test file imports no second test runtime.
 *
 * Every seam the framework owns is one a spec must not reach around: a test
 * that imports the adapter speaks the adapter's dialect, and a repository ends
 * up with as many vocabularies as it has seams. The groups the rule carries are
 * every seam this vocabulary replaces — the runner, the browser, the simulator,
 * the network, the clock and the doubles — each carrying the destination that
 * answers the need it was reached for.
 *
 * `react-dom/server` is the one group with a role of its own: rendering a
 * component to a string in a `.test.ts` is the shape the fork exists to name,
 * and in a `.test.tsx` it is a legitimate thing for a component to do.
 */
export const f6NoForeignTestRuntime: LintRule = {
    create(context: RuleContext) {
        const { role } = roleOf(context.physicalFilename);
        if (!REACHED.has(role)) {
            return {};
        }
        const visitor: Visitor = {
            ...importSourceVisitor(({ node, source }) => {
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
        };
        return visitor;
    },
    meta: {
        docs: RULE_DOCS['f6-no-foreign-test-runtime'],
        messages: {
            foreignRuntime: '`{{source}}` is a second test runtime in a test file: {{fix}}.',
        },
        type: 'problem',
    },
};
