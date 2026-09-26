import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { isFile } from '../../../engine/project/fs-cache.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import type { FileIdentity } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { consumerRows } from '../../catalogue/manifest.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/u;

function neighboursOf(file: string): string[] {
    return ['.ts', '.tsx', '.js'].map((extension) => file.replace(TEST_FILE, extension));
}

/** The orphan clause reads `role` and `inSpecs`, never a `src` segment: a repository suite covers a tree and has no neighbour to miss. */
function owesANeighbour({ inSpecs, strayTestRoot, role }: FileIdentity): boolean {
    if (strayTestRoot !== null) {
        return false;
    }
    return role === 'component' || (role === 'module' && !inSpecs);
}

export const testBesideItsModule: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const identity = identityOf(context);
                return (
                    identity.strayTestRoot !== null ||
                    (owesANeighbour(identity) && TEST_FILE.test(context.physicalFilename))
                );
            },
            Program(node: AstNode) {
                const file = context.physicalFilename;
                const identity = identityOf(context);
                if (identity.strayTestRoot !== null) {
                    const messageId =
                        identity.strayTestRoot === '__tests__' ? 'testsDir' : 'rootTests';
                    context.report({
                        data: { directory: identity.strayTestRoot },
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
        docs: rowNamed(consumerRows, 'test-beside-its-module'),
        messages: lessonsAt(rowNamed(consumerRows, 'test-beside-its-module'), {
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
