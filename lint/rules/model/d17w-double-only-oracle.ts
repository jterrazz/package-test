import type { Context } from '@oxlint/plugins';

import {
    assertionOf,
    chainRootName,
    child,
    childList,
    findTestCallback,
    identifierName,
    isTestCallee,
    memberPath,
    walk,
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

const DOUBLE_FACTORIES = new Set(['mockOf', 'vi.fn', 'vi.spyOn']);

function readsTheCallLog(matcher: string): boolean {
    return matcher.startsWith('toHaveBeenCalled') || matcher.startsWith('toHaveBeenLastCalled');
}

function makesADouble(init: AstNode | undefined): boolean {
    if (init === undefined) {
        return false;
    }
    if (init.type === 'AwaitExpression') {
        return makesADouble(child(init, 'argument'));
    }
    if (init.type !== 'CallExpression') {
        return false;
    }
    const path = memberPath(child(init, 'callee'));
    return path !== undefined && DOUBLE_FACTORIES.has(path);
}

function doubleBindings(root: AstNode): Set<string> {
    const names = new Set<string>();
    walk(root, (node) => {
        if (node.type !== 'VariableDeclarator' || !makesADouble(child(node, 'init'))) {
            return;
        }
        const name = identifierName(child(node, 'id'));
        if (name !== undefined) {
            names.add(name);
        }
    });
    return names;
}

/** Module tests only: on a component a callback prop is the contract with the parent, and reading it is honest. */
export const d17wDoubleOnlyOracle: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const identity = identityOf(context);
                return identity.role === 'module' && !identity.inSpecs;
            },
            Program(program: AstNode) {
                const doubles = doubleBindings(program);
                walk(program, (node) => {
                    if (node.type !== 'CallExpression' || !isTestCallee(child(node, 'callee'))) {
                        return;
                    }
                    const callback = findTestCallback(childList(node, 'arguments'));
                    if (callback === undefined) {
                        return;
                    }
                    const local = new Set([...doubles, ...doubleBindings(callback)]);
                    let assertions = 0;
                    let onDoubles = 0;
                    walk(callback, (inner) => {
                        const assertion = assertionOf(inner);
                        if (assertion === undefined) {
                            return;
                        }
                        assertions += 1;
                        const root = chainRootName(assertion.subject);
                        if (
                            root !== undefined &&
                            local.has(root) &&
                            readsTheCallLog(assertion.matcher)
                        ) {
                            onDoubles += 1;
                        }
                    });
                    if (assertions >= 1 && assertions === onDoubles) {
                        context.report({ messageId: 'doubleOnly', node });
                    }
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d17w-double-only-oracle'],
        messages: lessons('d17w-double-only-oracle', {
            doubleOnly: {
                found: 'every assertion reads a double this test built',
                fix: 'assert the value the subject returned, or the state it left',
            },
        }),
        type: 'suggestion',
    },
};
