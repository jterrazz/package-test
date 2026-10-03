import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, childList, identifierName, stringValue } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import type { LintedFile } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const WRAPPERS = new Set(['directory', 'file']);

function isEntry(source: string, filename: string): boolean {
    if (source === '@jterrazz/test') {
        return true;
    }
    return (
        source.startsWith('.') && /\/src\/index\.[jt]s$/u.test(resolve(dirname(filename), source))
    );
}

function isTest(file: LintedFile): boolean {
    return isTestRole(identityOf(file).role) || file.physicalFilename.endsWith('.test-d.ts');
}

const row = rowNamed(consumerRows, 'paths-named-in-the-test');

export const pathsNamedInTheTest = defineRule(
    {
        docs: row,
        messages: {
            builtOutsideTest: {
                found: '`{{name}}()` called outside a test',
                fix: 'take the `{{name}}()` as a parameter, and build it in the test that stands on it',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            let bound = new Set<string>();
            return {
                before() {
                    bound = new Set();
                    return !isTest(context);
                },
                CallExpression(node: AstNode) {
                    const name = identifierName(child(node, 'callee'));
                    // Stryker disable next-line ConditionalExpression: no name is bound
                    if (name !== undefined && bound.has(name)) {
                        context.report({ data: { name }, messageId: 'builtOutsideTest', node });
                    }
                },
                ImportDeclaration(node: AstNode) {
                    const source = stringValue(child(node, 'source'));
                    // Stryker disable next-line ConditionalExpression: an import always names its source
                    if (source === undefined || !isEntry(source, context.physicalFilename)) {
                        return;
                    }
                    for (const specifier of childList(node, 'specifiers')) {
                        const imported = identifierName(child(specifier, 'imported'));
                        const local = identifierName(child(specifier, 'local'));
                        // Stryker disable ConditionalExpression,LogicalOperator: no undefined is a wrapper, and an import always binds a local name
                        if (
                            imported !== undefined &&
                            WRAPPERS.has(imported) &&
                            local !== undefined
                        ) {
                            bound.add(local);
                        }
                        // Stryker restore ConditionalExpression,LogicalOperator
                    }
                },
            };
        },
    },
);
