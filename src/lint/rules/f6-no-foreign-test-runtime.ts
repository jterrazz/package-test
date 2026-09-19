import { importSourceVisitor } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { isTestFile } from '../role.js';
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
 * CONVENTIONS F6 — a test file imports no second test runtime.
 *
 * Every seam the framework owns is one a spec must not reach around: a test
 * that imports the adapter speaks the adapter's dialect, and a repository ends
 * up with as many vocabularies as it has seams. The groups that ship with the
 * component facet are the ones that facet REPLACES; the rest of the family
 * (the mocking libraries, the raw contract engines, the drivers) lands with the
 * rule wave in 16.0, where the migrations that need them are worked.
 */
export const f6NoForeignTestRuntime: LintRule = {
    create(context: RuleContext) {
        if (!isTestFile(context.physicalFilename)) {
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
            foreignRuntime:
                '`{{source}}` is a second test runtime in a test file: {{fix}} (F6 — docs/13-linting.md#f6-no-foreign-test-runtime).',
        },
        type: 'problem',
    },
};
