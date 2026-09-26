import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import type { Visitor } from '../../reading/ast.js';
import { moduleReferenceVisitor } from '../../reading/production.js';
import type { LintRule } from '../rule.js';

const TEST_FILE = /\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$/u;
const FIXTURES_IMPORT = /\.fixtures(?:\.[cm]?[jt]sx?)?$/u;

export const fixturesImportedByTestsOnly: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            ...moduleReferenceVisitor(({ node, source }) => {
                if (FIXTURES_IMPORT.test(source)) {
                    context.report({ data: { source }, messageId: 'fixturesImport', node });
                }
            }),
            before: () => !TEST_FILE.test(context.filename),
        };
    },
    meta: {
        docs: rowOf('fixtures-imported-by-tests-only'),
        messages: lessons('fixtures-imported-by-tests-only', {
            fixturesImport: {
                found: 'a non-test file imports the fixtures module "{{source}}"',
                fix: 'import it from a `*.test.ts` only, or move what the file needs into a module of its own',
            },
        }),
        type: 'problem',
    },
};
