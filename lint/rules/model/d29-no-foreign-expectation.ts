import type { Context } from '@oxlint/plugins';
import { dirname, resolve, sep } from 'node:path';

import { assertionOf, child, childList, identifierName, stringValue, walk } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf, specsAnchorOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

function isRunnerOrStub(source: string): boolean {
    return /\.specification(?:\.[jt]s)?$/u.test(source) || /(?:^|\/)stubs\//u.test(source);
}

/** A module outside the specs tree is the subject's data, not an expectation someone wrote for the test. */
function foreignNames(program: AstNode, filename: string, specs: string): Map<string, string> {
    const names = new Map<string, string>();
    for (const statement of childList(program, 'body')) {
        const source = stringValue(child(statement, 'source')) ?? '';
        if (
            statement.type !== 'ImportDeclaration' ||
            !/^\.\.?\//u.test(source) ||
            isRunnerOrStub(source) ||
            !resolve(dirname(filename), source).startsWith(`${specs}${sep}`)
        ) {
            continue;
        }
        for (const specifier of childList(statement, 'specifiers')) {
            const local = identifierName(child(specifier, 'local'));
            if (local !== undefined) {
                names.set(local, source);
            }
        }
    }
    return names;
}

function rootRead(argument: AstNode): string | undefined {
    let current: AstNode | undefined = argument;
    while (current?.type === 'MemberExpression') {
        current = child(current, 'object');
    }
    return identifierName(current);
}

/** A typed helper is called, and what it builds is the test's own. */
export const d29NoForeignExpectation: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () =>
                identityOf(context).role === 'spec' && specsAnchorOf(context) !== undefined,
            Program(program: AstNode) {
                const specs = specsAnchorOf(context)?.directory ?? '';
                const foreign = foreignNames(program, context.physicalFilename, specs);
                if (foreign.size === 0) {
                    return;
                }
                walk(program, (node) => {
                    if (assertionOf(node) === undefined) {
                        return;
                    }
                    for (const argument of childList(node, 'arguments')) {
                        const name = rootRead(argument);
                        const source = name === undefined ? undefined : foreign.get(name);
                        if (name !== undefined && source !== undefined) {
                            context.report({
                                data: { name, source },
                                messageId: 'imported',
                                node: argument,
                            });
                        }
                    }
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d29-no-foreign-expectation'],
        messages: lessons('d29-no-foreign-expectation', {
            imported: {
                found: 'the expectation `{{name}}`, imported from "{{source}}"',
                fix: 'write the expected value in this test — in place, or `file(…)` when several tests of this leaf share it — and stop importing `{{name}}`',
            },
        }),
        type: 'suggestion',
    },
};
