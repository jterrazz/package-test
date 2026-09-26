import type { Context } from '@oxlint/plugins';
import { dirname, resolve } from 'node:path';

import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import { child, childList, identifierName, stringValue } from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import type { LintedFile } from '../../reading/linted-file.js';
import { isTestRole } from '../../reading/role.js';
import type { LintRule, Visitor } from '../rule.js';

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

export const c26DiskNamedInTheTest: LintRule = {
    createOnce(context: Context): Visitor {
        let bound = new Set<string>();
        return {
            before() {
                bound = new Set();
                return !isTest(context);
            },
            CallExpression(node: AstNode) {
                const name = identifierName(child(node, 'callee'));
                if (name !== undefined && bound.has(name)) {
                    context.report({ data: { name }, messageId: 'builtOutsideTest', node });
                }
            },
            ImportDeclaration(node: AstNode) {
                const source = stringValue(child(node, 'source'));
                if (source === undefined || !isEntry(source, context.physicalFilename)) {
                    return;
                }
                for (const specifier of childList(node, 'specifiers')) {
                    const imported = identifierName(child(specifier, 'imported'));
                    const local = identifierName(child(specifier, 'local'));
                    if (imported !== undefined && WRAPPERS.has(imported) && local !== undefined) {
                        bound.add(local);
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c26-disk-named-in-the-test'],
        messages: lessons('c26-disk-named-in-the-test', {
            builtOutsideTest: {
                found: '`{{name}}()` called outside a test',
                fix: 'take the `{{name}}()` as a parameter, and build it in the test that stands on it',
            },
        }),
        type: 'problem',
    },
};
