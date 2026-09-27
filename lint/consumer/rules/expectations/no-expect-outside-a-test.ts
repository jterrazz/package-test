import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { child, childList, identifierName, stringValue } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const TYPE_TEST = /\.test-d\.tsx?$/u;

function assertsHere(context: Context): boolean {
    const { inSpecs, role } = identityOf(context);
    return (
        inSpecs &&
        !isTestRole(role) &&
        role !== 'ground' &&
        !TYPE_TEST.test(context.physicalFilename)
    );
}

function vitestExpectNames(node: AstNode): string[] {
    if (stringValue(child(node, 'source')) !== 'vitest') {
        return [];
    }
    return childList(node, 'specifiers').flatMap((specifier) =>
        specifier.type === 'ImportSpecifier' &&
        identifierName(child(specifier, 'imported')) === 'expect'
            ? [identifierName(child(specifier, 'local')) ?? 'expect']
            : [],
    );
}

function calleeRoot(callee: AstNode | undefined): string | undefined {
    return callee?.type === 'MemberExpression'
        ? identifierName(child(callee, 'object'))
        : identifierName(callee);
}

export const noExpectOutsideATest: LintRule = {
    createOnce(context: Context): Visitor {
        const bound = new Set<string>();
        return {
            before: () => {
                bound.clear();
                return assertsHere(context);
            },
            ImportDeclaration(node: AstNode) {
                for (const name of vitestExpectNames(node)) {
                    bound.add(name);
                }
            },
            CallExpression(node: AstNode) {
                const root = calleeRoot(child(node, 'callee'));
                if (root !== undefined && bound.has(root)) {
                    context.report({ messageId: 'expectOutsideATest', node });
                }
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'no-expect-outside-a-test'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'no-expect-outside-a-test'),
            {
                expectOutsideATest: {
                    found: "vitest's `expect()` called in a file under `specs/` that is no test",
                    fix: 'return what the module reads, and assert it in the test that calls it',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
