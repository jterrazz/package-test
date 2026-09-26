import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import { importSourceVisitor } from '../../reading/ast.js';
import type { LintRule, Visitor } from '../rule.js';

const TEST_FILE = /\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$/u;
const TEST_IMPORT = /\.test(?:\.[cm]?[jt]sx?)?$/u;

export const noTestToTestImport: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            ...importSourceVisitor(({ node, source }) => {
                if (TEST_IMPORT.test(source)) {
                    context.report({ data: { source }, messageId: 'testToTest', node });
                }
            }),
            before: () => TEST_FILE.test(context.filename),
        };
    },
    meta: {
        docs: rowOf('no-test-to-test-import'),
        messages: lessons('no-test-to-test-import', {
            testToTest: {
                found: 'a test file imports the test file "{{source}}"',
                fix: 'share the data through a `*.fixtures.ts` neighbour, or the runner through a `*.specification.ts`',
            },
        }),
        type: 'problem',
    },
};
