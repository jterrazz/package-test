import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { importSourceVisitor } from '../../../engine/project/ast.js';
import type { Visitor } from '../../../engine/project/ast.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { consumerRows } from '../../catalogue/manifest.js';

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
        docs: rowNamed(consumerRows, 'no-test-to-test-import'),
        messages: lessonsAt(rowNamed(consumerRows, 'no-test-to-test-import'), {
            testToTest: {
                found: 'a test file imports the test file "{{source}}"',
                fix: 'share the data through a `*.fixtures.ts` neighbour, or the runner through a `*.specification.ts`',
            },
        }),
        type: 'problem',
    },
};
