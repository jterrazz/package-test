import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    identifierName,
    memberPropertyName,
    nodeEnd,
    nodeStart,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { importSourceVisitor } from '../../../kit/project/import-sources.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const DOUBLE_FACTORIES = new Set(['fn', 'mockImplementation', 'mockImplementationOnce', 'mockOf']);

/** Member forms are read by their property alone: the object is whatever the test called its double. */
function isDoubleImplementation(node: AstNode): boolean {
    const callee = child(node, 'callee');
    // Stryker disable next-line ConditionalExpression: a call always has a callee
    if (callee === undefined) {
        return false;
    }
    const name = callee.type === 'Identifier' ? identifierName(callee) : memberPropertyName(callee);
    // Stryker disable next-line ConditionalExpression: no name is in the set
    return name !== undefined && DOUBLE_FACTORIES.has(name);
}

/** An object literal of a port's methods is a double too. */
function implementationOf(node: AstNode): AstNode | undefined {
    const value = child(node, 'value');
    // Stryker disable next-line OptionalChaining: a property always has a value
    return value?.type === 'ArrowFunctionExpression' || value?.type === 'FunctionExpression'
        ? value
        : undefined;
}

function isSleep(node: AstNode): boolean {
    const callee = child(node, 'callee');
    // Stryker disable next-line ConditionalExpression: a call always has a callee
    if (callee === undefined) {
        return false;
    }
    const name = callee.type === 'Identifier' ? identifierName(callee) : memberPropertyName(callee);
    // invariant: `Atomics.wait(…)` blocks the thread: a sleep in disguise.
    return (
        name === 'setTimeout' ||
        name === 'setInterval' ||
        (name === 'wait' &&
            // Stryker disable next-line ConditionalExpression: only a member has an object
            callee.type === 'MemberExpression' &&
            identifierName(child(callee, 'object')) === 'Atomics')
    );
}

const row = rowNamed(consumerRows, 'no-sleep');

/** A timer inside a double's implementation stages the world (a clone that settles late) and is not the test waiting. */
export const noSleep = defineRule(
    {
        docs: row,
        messages: {
            sleep: {
                found: 'an arbitrary sleep in a test',
                fix: 'wait on what the sleep stands for: `await waitUntil(() => <condition>)`, or `see()`/`gone()` inside a scenario',
            },
            timersImport: {
                found: 'a timer-based sleep imported into a test',
                fix: 'delete the import and wait on the condition: `await waitUntil(() => <condition>)`, or `see()`/`gone()` inside a scenario',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            // outside: the walk is top-down, so a double's span is recorded before anything inside it: the plugin API gives no parent pointer.
            // Stryker disable ArrayDeclaration,EqualityOperator,ConditionalExpression: an entry that is no span holds no node, and the walk meets a node inside a double only after it
            let doubles: { end: number; start: number }[] = [];
            const insideADouble = (node: AstNode): boolean =>
                doubles.some((span) => nodeStart(node) >= span.start && nodeEnd(node) <= span.end);
            return {
                before() {
                    doubles = [];
                    // Stryker restore ArrayDeclaration,EqualityOperator,ConditionalExpression
                    return isTestRole(identityOf(context).role);
                },
                // invariant: opened on the function, not the object, so a `setTimeout(…)` in a non-function property is still the test's own.
                Property(node: AstNode) {
                    const implementation = implementationOf(node);
                    // Stryker disable next-line ConditionalExpression: no implementation spans nothing
                    if (implementation !== undefined) {
                        doubles.push({
                            end: nodeEnd(implementation),
                            start: nodeStart(implementation),
                        });
                    }
                },
                CallExpression(node: AstNode) {
                    if (isDoubleImplementation(node)) {
                        doubles.push({ end: nodeEnd(node), start: nodeStart(node) });
                        return;
                    }
                    if (insideADouble(node)) {
                        return;
                    }
                    if (isSleep(node)) {
                        context.report({ messageId: 'sleep', node });
                    }
                },
                ...importSourceVisitor(({ node, source }) => {
                    if (source === 'node:timers/promises' || source === 'timers/promises') {
                        context.report({ messageId: 'timersImport', node });
                    }
                }),
            };
        },
    },
);
