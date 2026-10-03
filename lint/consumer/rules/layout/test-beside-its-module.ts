import { defineRule, isFile, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import type { FileIdentity } from '../../../kit/project/role.js';
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

const row = rowNamed(consumerRows, 'test-beside-its-module');

export const testBesideItsModule = defineRule(
    {
        docs: row,
        messages: {
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
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
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
                        data: {
                            expected: neighbours[rendered ? 1 : 0]?.split(/[/\\]/u).at(-1) ?? '',
                        },
                        messageId: rendered ? 'orphanComponent' : 'orphanTest',
                        node,
                    });
                },
            };
        },
    },
);
