import type { Context } from '@oxlint/plugins';

import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import { moduleReferenceVisitor } from '../../reading/production.js';
import type { LintRule, Visitor } from '../rule.js';

const TEST_FILE = /\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$/u;
const FIXTURES_IMPORT = /\.fixtures(?:\.[cm]?[jt]sx?)?$/u;

export const f5FixturesOnlyFromTests: LintRule = {
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
        docs: RULE_DOCS['f5-fixtures-only-from-tests'],
        messages: lessons('f5-fixtures-only-from-tests', {
            fixturesImport: {
                found: 'a non-test file imports the fixtures module "{{source}}"',
                fix: 'import it from a `*.test.ts` only, or move what the file needs into a module of its own',
            },
        }),
        type: 'problem',
    },
};
