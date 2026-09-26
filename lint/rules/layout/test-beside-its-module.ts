import type { Context } from '@oxlint/plugins';

import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import type { AstNode } from '../../reading/ast.js';
import { isFile } from '../../reading/fs-cache.js';
import { identityOf } from '../../reading/linted-file.js';
import type { FileIdentity } from '../../reading/role.js';
import type { LintRule, Visitor } from '../rule.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/u;

function neighboursOf(file: string): string[] {
    return ['.ts', '.tsx', '.js'].map((extension) => file.replace(TEST_FILE, extension));
}

/** The orphan clause reads `role` and `inSpecs`, never a `src` segment: a repository suite covers a tree and has no neighbour to miss. */
function owesANeighbour({ inSpecs, legacyDir, role }: FileIdentity): boolean {
    if (legacyDir !== null) {
        return false;
    }
    return role === 'component' || (role === 'module' && !inSpecs);
}

export const i2SiblingTestNaming: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const identity = identityOf(context);
                return (
                    identity.legacyDir !== null ||
                    (owesANeighbour(identity) && TEST_FILE.test(context.physicalFilename))
                );
            },
            Program(node: AstNode) {
                const file = context.physicalFilename;
                const identity = identityOf(context);
                if (identity.legacyDir !== null) {
                    const messageId = identity.legacyDir === '__tests__' ? 'testsDir' : 'rootTests';
                    context.report({
                        data: { directory: identity.legacyDir },
                        messageId,
                        node,
                    });
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
        messages: lessons('i2-sibling-test-naming', {
            orphanComponent: {
                found: 'a component test with no neighbour "{{expected}}"',
                fix: 'move it next to what it renders — a hook or a DOM function is the `.ts` of the same basename, its Host in the test',
            },
            orphanTest: {
                found: 'a module test with no neighbour "{{expected}}"',
                fix: 'move it next to the module it tests; a test needing more than its module is a spec — move it under `specs/` as a `.spec.ts`',
            },
            rootTests: {
                found: 'a package-level `{{directory}}/` directory',
                fix: 'move each module test beside its module under `src/`, and each product specification under `specs/`',
            },
            testsDir: {
                found: 'a `__tests__/` directory',
                fix: 'move each test beside its module: the test of `<file>.ts` is `<file>.test.ts`',
            },
        }),
        type: 'problem',
    },
};
