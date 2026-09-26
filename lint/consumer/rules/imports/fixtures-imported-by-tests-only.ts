import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import type { Visitor } from '../../../engine/project/ast.js';
import { moduleReferenceVisitor } from '../../../engine/project/production.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

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
        docs: rowNamed(consumerRows, 'fixtures-imported-by-tests-only'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'fixtures-imported-by-tests-only'),
            {
                fixturesImport: {
                    found: 'a non-test file imports the fixtures module "{{source}}"',
                    fix: 'import it from a `*.test.ts` only, or move what the file needs into a module of its own',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
