import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import {
    assertionOf,
    child,
    childList,
    identifierName,
    isNode,
    isTestCallee,
    nodeEnd,
    nodeStart,
    walk,
} from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
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

/** Never a member's name, an object key, or its own declaration. */
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
            if (name !== undefined) {
                names.add(name);
            }
        }
    });
    return names;
}

function testSpans(program: AstNode): Span[] {
    const spans: Span[] = [];
    walk(program, (node) => {
        if (node.type === 'CallExpression' && isTestCallee(child(node, 'callee'))) {
            spans.push({ end: nodeEnd(node), start: nodeStart(node) });
        }
    });
    return spans;
}

function testOf(read: AstNode, tests: Span[]): Span | undefined {
    return tests.find((span) => nodeStart(read) >= span.start && nodeEnd(read) <= span.end);
}

function fileConstants(program: AstNode): { declarator: AstNode; statement: AstNode }[] {
    return childList(program, 'body').flatMap((statement) => {
        const declaration =
            statement.type === 'ExportNamedDeclaration'
                ? child(statement, 'declaration')
                : statement;
        if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== 'const') {
            return [];
        }
        return childList(declaration, 'declarations').map((declarator) => ({
            declarator,
            statement,
        }));
    });
}

/** A constant a helper reads counts as shared: no scan can tell how many tests call the helper. */
export const expectedConstantShared: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => identityOf(context).role === 'spec',
            Program(program: AstNode) {
                const expected = expectedNames(program);
                const tests = testSpans(program);
                for (const { declarator, statement } of fileConstants(program)) {
                    if (statement.type === 'ExportNamedDeclaration') {
                        continue;
                    }
                    const name = identifierName(child(declarator, 'id'));
                    const init = child(declarator, 'init');
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
                        only !== undefined &&
                        statement.type === 'VariableDeclaration' &&
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
    meta: {
        docs: rowNamed(consumerRows, 'expected-constant-shared'),
        fixable: 'code',
        messages: lessonsAt(
            rowNamed(consumerRows, 'expected-constant-shared'),
            {
                singleReader: {
                    found: 'the expectation `{{name}}`, declared for the file and read by one test',
                    fix: 'write its value in place, in the matcher the test hands it to, and delete `{{name}}` — `make fix` inlines it',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'suggestion',
    },
};
