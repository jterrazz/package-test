import type { Context } from '@oxlint/plugins';

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
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** A source span: where a node starts and ends. */
type Span = { end: number; start: number };

/** The key of a node that holds a NAME rather than a read: a member's, an object key, a declared id. */
const NAMING_KEYS: Record<string, string> = {
    MemberExpression: 'property',
    Property: 'key',
    VariableDeclarator: 'id',
};

/** Does `key` of `node` hold a name rather than a read? */
function namesNotReads(node: AstNode, key: string): boolean {
    return key === 'parent' || (NAMING_KEYS[node.type] === key && node.computed !== true);
}

/** Every place an identifier is READ — never a member's name, an object key, or its own declaration. */
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

/** The names a file hands straight to a matcher as the expected value. */
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

/** The spans of the file's tests — a `test(…)`/`it(…)` call, modifiers included. */
function testSpans(program: AstNode): Span[] {
    const spans: Span[] = [];
    walk(program, (node) => {
        if (node.type === 'CallExpression' && isTestCallee(child(node, 'callee'))) {
            spans.push({ end: nodeEnd(node), start: nodeStart(node) });
        }
    });
    return spans;
}

/** The test a read stands in, by its span — none for a read outside every test. */
function testOf(read: AstNode, tests: Span[]): Span | undefined {
    return tests.find((span) => nodeStart(read) >= span.start && nodeEnd(read) <= span.end);
}

/** The file-level `const` declarators, each with the statement that declares it. */
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

/**
 * CONVENTIONS D28 — a file-level expectation serves several tests. A `const`
 * at the top of a spec handed to a matcher as the expected value, and read by
 * ONE test, is that test's expectation written away from it: the reader of the
 * test has to scroll to know what it expects, and nothing is shared for the
 * price. Read by two tests or more, it is shared and stays.
 *
 * `--fix` writes the value in place when the test reads it once, and deletes
 * the constant. A constant a helper reads — outside every test — counts as
 * shared: no scan can tell how many tests call the helper.
 */
export const d28SharedExpectation: LintRule = {
    create(context: Context): Visitor {
        if (identityOf(context).role !== 'spec') {
            return {};
        }
        return {
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
        docs: RULE_DOCS['d28-shared-expectation'],
        fixable: 'code',
        messages: lessons('d28-shared-expectation', {
            singleReader: {
                found: 'the expectation `{{name}}`, declared for the file and read by one test',
                fix: 'write its value in place, in the matcher the test hands it to, and delete `{{name}}` — `make fix` inlines it',
            },
        }),
        type: 'suggestion',
    },
};
