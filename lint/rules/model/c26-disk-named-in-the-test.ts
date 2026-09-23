import { dirname, resolve } from 'node:path';

import { child, childList, identifierName, stringValue } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';
import { isTestRole, roleOf } from '../../role.js';

/** The two calls that name the disk. */
const WRAPPERS = new Set(['directory', 'file']);

/** The framework's entry: the published name, or this repository's own source entry. */
function isEntry(source: string, filename: string): boolean {
    if (source === '@jterrazz/test') {
        return true;
    }
    return (
        source.startsWith('.') && /\/src\/index\.[jt]s$/u.test(resolve(dirname(filename), source))
    );
}

/** Is this file a test — the three test roles, and a type test (`*.test-d.ts`)? */
function isTest(filename: string): boolean {
    return isTestRole(roleOf(filename).role) || filename.endsWith('.test-d.ts');
}

/**
 * CONVENTIONS C26 — `file()` and `directory()` are called in a test or spec
 * file, and nowhere else. A path is resolved against the spec that starts the
 * chain, so one built in a shared helper would resolve per caller: the same
 * line naming a different file for every spec that reaches it. A helper takes
 * the `file()` as a parameter; the test builds it, on the line a reader reads.
 */
export const c26DiskNamedInTheTest: LintRule = {
    create(context: RuleContext): Visitor {
        const filename = context.physicalFilename;
        if (isTest(filename)) {
            return {};
        }
        const bound = new Set<string>();
        return {
            CallExpression(node: AstNode) {
                const name = identifierName(child(node, 'callee'));
                if (name !== undefined && bound.has(name)) {
                    context.report({ data: { name }, messageId: 'builtOutsideTest', node });
                }
            },
            ImportDeclaration(node: AstNode) {
                const source = stringValue(child(node, 'source'));
                if (source === undefined || !isEntry(source, filename)) {
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
