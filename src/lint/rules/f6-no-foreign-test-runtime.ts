import { importSourceVisitor } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { FileRole } from '../role.js';
import type { LintRule, RuleContext, Visitor } from '../types.js';

/**
 * A foreign runtime, and what the framework offers in its place. The message a
 * group carries is its FIX, because a ban with no destination is an argument
 * rather than a rule.
 */
type Group = {
    fix: string;
    matches: (source: string) => boolean;
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
];

/**
 * The roles that RUN a test — never a fixture app's config or a provider module
 * that happens to sit under `specs/`. A fixture project's own `vitest.config.ts`
 * has to name the provider, and a `providers.tsx` has to import the adapter it
 * wraps: neither is a spec speaking a second dialect.
 */
const REACHED = new Set<FileRole>(['component', 'module', 'specification']);

/**
 * CONVENTIONS F6 — a test file imports no second test runtime.
 *
 * Every seam the framework owns is one a spec must not reach around: a test
 * that imports the adapter speaks the adapter's dialect, and a repository ends
 * up with as many vocabularies as it has seams. The groups the rule carries are
 * the ones the component facet REPLACES.
 */
export const f6NoForeignTestRuntime: LintRule = {
    create(context: RuleContext) {
        if (!REACHED.has(roleOf(context.physicalFilename).role)) {
            return {};
        }
        const visitor: Visitor = {
            ...importSourceVisitor(({ node, source }) => {
                const group = GROUPS.find((candidate) => candidate.matches(source));
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
