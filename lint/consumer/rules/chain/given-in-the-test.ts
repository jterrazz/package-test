import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { child, childList, identifierName, memberPath, walk } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const BUILDERS = new Set(['beforeAll', 'beforeEach']);

const TEARDOWNS = new Set(['afterAll', 'afterEach']);

const RESTORES = new Set([
    'cleanup',
    'vi.resetAllMocks',
    'vi.restoreAllMocks',
    'vi.unstubAllEnvs',
    'vi.unstubAllGlobals',
    'vi.useRealTimers',
]);

function restoreOnly(hook: AstNode): boolean {
    const callback = childList(hook, 'arguments')[0];
    if (callback === undefined) {
        return false;
    }
    // `afterAll(cleanup)`, `afterEach(vi.restoreAllMocks)`: a restore handed over by name.
    const handedOver = memberPath(callback) ?? identifierName(callback);
    if (handedOver !== undefined) {
        return RESTORES.has(handedOver);
    }
    let calls = 0;
    let restores = 0;
    walk(callback, (inner) => {
        if (inner.type !== 'CallExpression') {
            return;
        }
        calls += 1;
        const path = memberPath(child(inner, 'callee'));
        if (path !== undefined && RESTORES.has(path)) {
            restores += 1;
        }
    });
    return calls >= 1 && calls === restores;
}

/** A teardown that only gives back is no Given, and stands. */
export const givenInTheTest: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => isTestRole(identityOf(context).role),
            CallExpression(node: AstNode) {
                const name = identifierName(child(node, 'callee'));
                if (name === undefined) {
                    return;
                }
                if (BUILDERS.has(name)) {
                    context.report({ data: { hook: name }, messageId: 'givenInAHook', node });
                    return;
                }
                if (TEARDOWNS.has(name) && !restoreOnly(node)) {
                    context.report({ data: { hook: name }, messageId: 'teardownDoesMore', node });
                }
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'given-in-the-test'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'given-in-the-test'),
            {
                givenInAHook: {
                    found: '`{{hook}}` moves the Given out of the tests',
                    fix: 'write the Given in each test — a shared value is a function each test calls, and `clock.at()` restores itself',
                },
                teardownDoesMore: {
                    found: '`{{hook}}` does more than give back what the test took',
                    fix: 'keep the restores in `{{hook}}`, and move the rest into the tests',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'suggestion',
    },
};
