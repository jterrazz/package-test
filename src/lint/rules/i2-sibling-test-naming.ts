import { segments } from '../ast.js';
import { isFile } from '../fs-cache.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext } from '../types.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/u;

/**
 * CONVENTIONS I2 — a unit's test is its NEIGHBOUR: the test of `<file>.ts` is
 * `<file>.test.ts` next to it (Go's `foo_test.go` parity). A rendered unit
 * answers to the same law wherever it lives: a `.test.tsx` sits beside the
 * `.tsx` it renders, or the `.ts` of the hook or DOM function it hosts. Flags,
 * on visited files:
 *
 * - a `src/**` test whose neighbour module `<file>.ts` does not exist;
 * - a `component`-role test (`*.test.tsx`) with no neighbour of any tree;
 * - any file living in a `__tests__/` directory under `src/`;
 * - any file under a root-level `tests/` directory (the only test roots are
 *   sibling tests under `src/` and product specifications in `specs/`).
 */
export const i2SiblingTestNaming: LintRule = {
    create(context: RuleContext) {
        const file = context.physicalFilename;
        const parts = segments(file);
        return {
            Program(node: AstNode) {
                const rendered = roleOf(file).role === 'component';
                if (parts.includes('src') || rendered) {
                    if (parts.includes('__tests__')) {
                        context.report({ messageId: 'testsDir', node });
                    } else if (TEST_FILE.test(file)) {
                        // The neighbour module may be .ts — or .js/.tsx in
                        // JS-shipping and React packages (same I2 parity).
                        const neighbours = ['.ts', '.tsx', '.js'].map((extension) =>
                            file.replace(TEST_FILE, extension),
                        );
                        if (!neighbours.some(isFile)) {
                            context.report({
                                data: {
                                    expected: neighbours[rendered ? 1 : 0]
                                        ?.split(/[/\\]/u)
                                        .at(-1) ?? '',
                                },
                                messageId: rendered ? 'orphanComponent' : 'orphanTest',
                                node,
                            });
                        }
                    }
                }
                const testsIndex = parts.indexOf('tests');
                if (testsIndex > 0) {
                    const rootCandidate = `/${parts.slice(0, testsIndex).join('/')}`;
                    if (isFile(`${rootCandidate}/package.json`)) {
                        context.report({ messageId: 'rootTests', node });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['i2-sibling-test-naming'],
        messages: {
            orphanComponent:
                'A component test must sit NEXT to what it renders — no neighbour "{{expected}}" found (I2 — see docs/13-linting.md). A hook or a DOM function is the `.ts` of the same basename, with its Host in the test file.',
            orphanTest:
                'A src/ module test must sit NEXT to the module it tests — no neighbour "{{expected}}" found (I2 — see docs/13-linting.md). A test needing more than its module is a specification: move it to specs/.',
            rootTests:
                'A root-level tests/ directory is banned — module tests are siblings under src/, product specifications live in specs/ (I2 — see docs/13-linting.md).',
            testsDir:
                '__tests__/ directories are banned under src/ — the test of <file>.ts is its neighbour <file>.test.ts (I2 — see docs/13-linting.md).',
        },
        type: 'problem',
    },
};
