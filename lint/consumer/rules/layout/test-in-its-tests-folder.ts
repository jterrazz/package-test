import { defineRule, isFile, readAt, rowNamed, TESTS_FOLDER } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { basename, dirname, join } from 'node:path';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import type { FileIdentity } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/u;

const MODULE_EXTENSIONS = ['.ts', '.tsx', '.js'];

/** The modules a test may name: `dir/__tests__/a.test.ts` names `dir/a.ts`, `dir/a.tsx` or `dir/a.js`; a component test under `specs/` names its neighbour. */
function modulesNamedBy(file: string, inTestsFolder: boolean): string[] {
    const folder = inTestsFolder ? dirname(dirname(file)) : dirname(file);
    const stem = basename(file).replace(TEST_FILE, '');
    return MODULE_EXTENSIONS.map((extension) => join(folder, `${stem}${extension}`));
}

/** A module or rendered test outside `specs/` lives in a `__tests__/`; a rendered unit under `specs/` keeps its neighbour, as a specs tree holds no `__tests__/`. A repository suite covers a tree and names no module. */
function isJudged({ inSpecs, role, strayTestRoot }: FileIdentity): boolean {
    // Stryker disable next-line ConditionalExpression: a stray root is reported before any module is asked for
    if (strayTestRoot !== null) {
        return false;
    }
    // Stryker disable next-line ConditionalExpression: a `.test` file outside specs/ is a module or a component
    return role === 'component' || (role === 'module' && !inSpecs);
}

const row = rowNamed(consumerRows, 'test-in-its-tests-folder');

export const testInItsTestsFolder = defineRule(
    {
        docs: row,
        messages: {
            orphanComponent: {
                found: 'a component test naming no "{{expected}}"',
                fix: 'name it for what it renders — a hook or a DOM function is the `.ts` of the same basename, its Host in the test',
            },
            orphanTest: {
                found: 'a module test naming no "{{expected}}" in the folder above its `__tests__/`',
                fix: 'name it for a module of that folder — `__tests__/<file>.test.ts` tests `<file>.ts`; a test needing more than its module is a spec — move it under `specs/` as a `.spec.ts`',
            },
            outsideTests: {
                found: 'a module test outside the `__tests__/` of its folder',
                fix: 'move it to `{{target}}`, and each relative path it imports one folder up (`./<file>.js` → `../<file>.js`)',
            },
            rootTests: {
                found: 'a package-level `{{directory}}/` directory',
                fix: 'move each module test into the `__tests__/` of its module’s folder under `src/`, and each product specification under `specs/`',
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
                        (isJudged(identity) && TEST_FILE.test(context.physicalFilename))
                    );
                },
                Program(node: AstNode) {
                    const file = context.physicalFilename;
                    const identity = identityOf(context);
                    if (identity.strayTestRoot !== null) {
                        context.report({
                            data: { directory: identity.strayTestRoot },
                            messageId: 'rootTests',
                            node,
                        });
                        return;
                    }
                    const inTestsFolder = basename(dirname(file)) === TESTS_FOLDER;
                    if (!identity.inSpecs && !inTestsFolder) {
                        context.report({
                            data: { target: `${TESTS_FOLDER}/${basename(file)}` },
                            messageId: 'outsideTests',
                            node,
                        });
                        return;
                    }
                    const modules = modulesNamedBy(file, inTestsFolder);
                    if (modules.some(isFile)) {
                        return;
                    }
                    const rendered = identity.role === 'component';
                    context.report({
                        data: {
                            // Stryker disable next-line OptionalChaining,LogicalOperator: three modules are always named
                            expected: basename(modules[rendered ? 1 : 0] ?? ''),
                        },
                        messageId: rendered ? 'orphanComponent' : 'orphanTest',
                        node,
                    });
                },
            };
        },
    },
);
