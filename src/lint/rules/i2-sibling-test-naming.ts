import { isFile } from '../fs-cache.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { FileIdentity } from '../role.js';
import type { AstNode, LintRule, RuleContext } from '../types.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/u;

/**
 * CONVENTIONS I2 — a unit's test is its NEIGHBOUR: the test of `<file>.ts` is
 * `<file>.test.ts` next to it (Go's `foo_test.go` parity). A rendered unit
 * answers to the same law wherever it lives: a `.test.tsx` sits beside the
 * `.tsx` it renders, or the `.ts` of the hook or DOM function it hosts. Flags:
 *
 * - a `module`-role test OUTSIDE `specs/` whose neighbour module does not exist;
 * - a `component`-role test (`*.test.tsx`) with no neighbour of any tree;
 * - any file under a retired test root (`__tests__/`, a package's `tests/`).
 *
 * The orphan clause reads `role` and `inSpecs`, never a `src` segment: a
 * REPOSITORY suite — a `.test.ts` under a `specs/` tree whose C1 depth is
 * `facet` — covers a whole tree, not one module, so it has no neighbour to
 * miss and this rule stays silent on it.
 */
/** The neighbour modules a test of this name may sit beside — `.js` for JS packages. */
function neighboursOf(file: string): string[] {
    return ['.ts', '.tsx', '.js'].map((extension) => file.replace(TEST_FILE, extension));
}

/**
 * Whether this file is one a NEIGHBOUR is owed: a rendered unit wherever it
 * lives, or a module test outside a `specs/` tree. A `module`-role file under
 * `specs/` is a repository suite — it covers a tree, so there is nothing for it
 * to sit beside.
 */
function owesANeighbour({ inSpecs, legacyDir, role }: FileIdentity): boolean {
    if (legacyDir !== null) {
        return false;
    }
    return role === 'component' || (role === 'module' && !inSpecs);
}

export const i2SiblingTestNaming: LintRule = {
    create(context: RuleContext) {
        const file = context.physicalFilename;
        const identity = roleOf(file);
        return {
            Program(node: AstNode) {
                if (identity.legacyDir !== null) {
                    const messageId = identity.legacyDir === 'tests' ? 'rootTests' : 'testsDir';
                    context.report({ messageId, node });
                    return;
                }
                if (!owesANeighbour(identity) || !TEST_FILE.test(file)) {
                    return;
                }
                const neighbours = neighboursOf(file);
                if (neighbours.some(isFile)) {
                    return;
                }
                const rendered = identity.role === 'component';
                context.report({
                    data: { expected: neighbours[rendered ? 1 : 0]?.split(/[/\\]/u).at(-1) ?? '' },
                    messageId: rendered ? 'orphanComponent' : 'orphanTest',
                    node,
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['i2-sibling-test-naming'],
        messages: {
            orphanComponent:
                'A component test must sit NEXT to what it renders — no neighbour "{{expected}}" found (I2 — see docs/13-linting.md). A hook or a DOM function is the `.ts` of the same basename, with its Host in the test file.',
            orphanTest:
                'A module test must sit NEXT to the module it tests — no neighbour "{{expected}}" found (I2 — see docs/13-linting.md). A test needing more than its module is a specification: move it under specs/ as a `.spec.ts`.',
            rootTests:
                'A root-level tests/ directory is banned — module tests are siblings under src/, product specifications live in specs/ (I2 — see docs/13-linting.md).',
            testsDir:
                '__tests__/ directories are banned — the test of <file>.ts is its neighbour <file>.test.ts (I2 — see docs/13-linting.md).',
        },
        type: 'problem',
    },
};
