import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { assertionOf } from '../../../kit/project/assertions.js';
import {
    child,
    childList,
    identifierName,
    isNode,
    nodeEnd,
    nodeStart,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestCallee } from '../../../kit/project/test-calls.js';
import { consumerRows } from '../../catalogue/manifest.js';

type Span = { end: number; start: number };

const NAMING_KEYS: Record<string, string> = {
    MemberExpression: 'property',
    Property: 'key',
    VariableDeclarator: 'id',
};

function namesNotReads(node: AstNode, key: string): boolean {
    return key === 'parent' || (NAMING_KEYS[node.type] === key && node.computed !== true);
}

// invariant: never a member's name, an object key, or its own declaration.
function readsOf(node: AstNode, name: string, reads: AstNode[] = []): AstNode[] {
    if (node.type === 'Identifier') {
        if (identifierName(node) === name) {
            reads.push(node);
        }
        return reads;
    }
    for (const key of Object.keys(node)) {
        if (namesNotReads(node, key)) {
            continue;
        }
        const value = node[key];
        const children: unknown[] = Array.isArray(value) ? value : [value];
        for (const entry of children) {
            if (isNode(entry)) {
                readsOf(entry, name, reads);
            }
        }
    }
    return reads;
}

function expectedNames(program: AstNode): Set<string> {
    const names = new Set<string>();
    walk(program, (node) => {
        if (assertionOf(node) === undefined) {
            return;
        }
        for (const argument of childList(node, 'arguments')) {
            const name = identifierName(argument);
            // Stryker disable next-line ConditionalExpression: undefined names no constant
            if (name !== undefined) {
                names.add(name);
            }
        }
    });
    return names;
}

function testSpans(program: AstNode): Span[] {
    // Stryker disable next-line ArrayDeclaration: an entry that is no span holds no read
    const spans: Span[] = [];
    walk(program, (node) => {
        // Stryker disable next-line ConditionalExpression: only a call has a test callee
        if (node.type === 'CallExpression' && isTestCallee(child(node, 'callee'))) {
            spans.push({ end: nodeEnd(node), start: nodeStart(node) });
        }
    });
    return spans;
}

function testOf(read: AstNode, tests: Span[]): Span | undefined {
    // Stryker disable next-line EqualityOperator: a read never starts or ends where a test call does
    return tests.find((span) => nodeStart(read) >= span.start && nodeEnd(read) <= span.end);
}

// invariant: an exported constant is not listed: it has readers elsewhere.
function fileConstants(program: AstNode): { declarator: AstNode; statement: AstNode }[] {
    return childList(program, 'body').flatMap((statement) => {
        // Stryker disable next-line ConditionalExpression: only a declaration has a `kind`
        if (statement.type !== 'VariableDeclaration' || statement.kind !== 'const') {
            // Stryker disable next-line ArrayDeclaration: an entry that is no constant names none
            return [];
        }
        return childList(statement, 'declarations').map((declarator) => ({
            declarator,
            statement,
        }));
    });
}

const row = rowNamed(consumerRows, 'expected-constant-shared');

/** A constant a helper reads counts as shared: no scan can tell how many tests call the helper. */
export const expectedConstantShared = defineRule(
    {
        docs: row,
        fixable: 'code',
        messages: {
            singleReader: {
                found: 'the expectation `{{name}}`, declared for the file and read by one test',
                fix: 'write its value in place, in the matcher the test hands it to, and delete `{{name}}`; `typescript fix` inlines it',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => identityOf(context).role === 'spec',
                Program(program: AstNode) {
                    const expected = expectedNames(program);
                    const tests = testSpans(program);
                    for (const { declarator, statement } of fileConstants(program)) {
                        const name = identifierName(child(declarator, 'id'));
                        const init = child(declarator, 'init');
                        // Stryker disable next-line ConditionalExpression,LogicalOperator: a const always has a value, and a name no expectation reads is none it holds
                        if (name === undefined || init === undefined || !expected.has(name)) {
                            continue;
                        }
                        const reads = readsOf(program, name);
                        const owners = new Set(reads.map((read) => testOf(read, tests)));
                        const [owner] = owners;
                        if (owners.size !== 1 || owner === undefined) {
                            continue;
                        }
                        const [only] = reads;
                        const inlinable =
                            reads.length === 1 &&
                            // Stryker disable next-line ConditionalExpression: one read is always there
                            only !== undefined &&
                            childList(statement, 'declarations').length === 1;
                        const { text } = context.sourceCode;
                        context.report({
                            data: { name },
                            ...(inlinable && {
                                fix: (fixer) => {
                                    const end =
                                        text[nodeEnd(statement)] === '\n'
                                            ? nodeEnd(statement) + 1
                                            : nodeEnd(statement);
                                    return [
                                        fixer.replaceTextRange(
                                            [nodeStart(only), nodeEnd(only)],
                                            text.slice(nodeStart(init), nodeEnd(init)),
                                        ),
                                        fixer.removeRange([nodeStart(statement), end]),
                                    ];
                                },
                            }),
                            messageId: 'singleReader',
                            node: declarator,
                        });
                    }
                },
            };
        },
    },
);
