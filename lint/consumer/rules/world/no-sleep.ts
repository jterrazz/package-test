import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import {
    child,
    identifierName,
    importSourceVisitor,
    memberPropertyName,
    nodeEnd,
    nodeStart,
} from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { consumerRows } from '../../catalogue/manifest.js';

const DOUBLE_FACTORIES = new Set(['fn', 'mockImplementation', 'mockImplementationOnce', 'mockOf']);

/** Member forms are read by their property alone: the object is whatever the test called its double. */
function isDoubleImplementation(node: AstNode): boolean {
    const callee = child(node, 'callee');
    if (callee === undefined) {
        return false;
    }
    const name = callee.type === 'Identifier' ? identifierName(callee) : memberPropertyName(callee);
    return name !== undefined && DOUBLE_FACTORIES.has(name);
}

/** An object literal of a port's methods is a double too. */
function implementationOf(node: AstNode): AstNode | undefined {
    const value = child(node, 'value');
    return value?.type === 'ArrowFunctionExpression' || value?.type === 'FunctionExpression'
        ? value
        : undefined;
}

/** A timer inside a double's implementation stages the world (a clone that settles late) and is not the test waiting. */
export const noSleep: LintRule = {
    createOnce(context: Context): Visitor {
        // The walk is top-down, so a double's span is recorded before anything inside it: the plugin API gives no parent pointer.
        let doubles: { end: number; start: number }[] = [];
        const insideADouble = (node: AstNode): boolean =>
            doubles.some((span) => nodeStart(node) >= span.start && nodeEnd(node) <= span.end);
        return {
            before() {
                doubles = [];
                return isTestRole(identityOf(context).role);
            },
            // Opened on the function, not the object, so a `setTimeout(…)` in a non-function property is still the test's own.
            Property(node: AstNode) {
                const implementation = implementationOf(node);
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
                const callee = child(node, 'callee');
                if (callee === undefined) {
                    return;
                }
                const name =
                    callee.type === 'Identifier'
                        ? identifierName(callee)
                        : memberPropertyName(callee);
                if (name === 'setTimeout' || name === 'setInterval') {
                    context.report({ messageId: 'sleep', node });
                    return;
                }
                // `Atomics.wait(…)` blocks the thread: a sleep in disguise.
                if (
                    name === 'wait' &&
                    callee.type === 'MemberExpression' &&
                    identifierName(child(callee, 'object')) === 'Atomics'
                ) {
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
    meta: {
        docs: rowNamed(consumerRows, 'no-sleep'),
        messages: lessonsAt(rowNamed(consumerRows, 'no-sleep'), {
            sleep: {
                found: 'an arbitrary sleep in a test',
                fix: 'wait on what the sleep stands for: `await waitUntil(() => <condition>)`, or `see()`/`gone()` inside a scenario',
            },
            timersImport: {
                found: 'a timer-based sleep imported into a test',
                fix: 'delete the import and wait on the condition: `await waitUntil(() => <condition>)`, or `see()`/`gone()` inside a scenario',
            },
        }),
        type: 'problem',
    },
};
