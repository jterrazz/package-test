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
} from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** The three ways this vocabulary makes a double. */
const DOUBLE_FACTORIES = new Set(['mockOf', 'vi.fn', 'vi.spyOn']);

/** The matchers that read a double's call log rather than a result. */
function readsTheCallLog(matcher: string): boolean {
    return matcher.startsWith('toHaveBeenCalled') || matcher.startsWith('toHaveBeenLastCalled');
}

/** Is the initialiser one of the double factories? */
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

/** Every binding in the file whose value is a double this test built. */
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

/**
 * CONVENTIONS D17w (warning) — a module test whose every assertion reads a
 * double it built itself.
 *
 * The test then proves that the test called the test: the subject can return
 * anything, raise anything, or return nothing at all, and every `expect` still
 * passes. Something the subject PRODUCED has to appear — a returned value, a
 * state read back, an error.
 *
 * The reach is the `module` role alone. On a component a callback prop IS the
 * contract with the parent, and `expect(onClose).toHaveBeenCalledOnce()` is the
 * only honest way to read it; on a spec the double is rare and the result
 * accessors are the subject.
 */
export const d17wDoubleOnlyOracle: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.filename).role !== 'module') {
            return {};
        }
        return {
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
        messages: {
            doubleOnly:
                'Every assertion reads a double this test built — assert the returned value or the resulting state.',
        },
        type: 'suggestion',
    },
};
