import { ruleTester } from '@jterrazz/test';
import type { Context } from '@oxlint/plugins';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { AstNode } from '../../../kit/project/ast.js';
import { checkoutUnder } from '../../../kit/testing/package-tree.fixtures.js';
import { seedsAreSql } from './seeds-are-sql.js';

// The fs-anchored cases run against the shared E2E fixture trees.
const SPECS_LINT = resolve(import.meta.dirname, '../../../../specs/lint');

const TWO_STRAYS = checkoutUnder('work', ['specs/app/widget/_seeds']);
writeFileSync(join(TWO_STRAYS, 'specs/app/widget/_seeds/users.json'), '[]\n');
writeFileSync(join(TWO_STRAYS, 'specs/app/widget/_seeds/users.csv'), 'id\n');

const UNTRACKED_STRAY = checkoutUnder('work', ['specs/app/widget/_seeds']);
writeFileSync(join(UNTRACKED_STRAY, 'specs/app/widget/_seeds/users.sql'), 'select 1;\n');
writeFileSync(join(UNTRACKED_STRAY, 'specs/app/widget/_seeds/users.json'), '[]\n');
execFileSync('git', ['init', '--quiet'], { cwd: UNTRACKED_STRAY });
execFileSync('git', ['add', 'package.json', 'specs/app/widget/_seeds/users.sql'], {
    cwd: UNTRACKED_STRAY,
});

const IGNORED_STRAY = checkoutUnder('work', ['specs/app/widget/_seeds']);
writeFileSync(join(IGNORED_STRAY, 'specs/app/widget/_seeds/users.sql'), 'select 1;\n');
writeFileSync(join(IGNORED_STRAY, 'specs/app/widget/_seeds/users.json'), '[]\n');
writeFileSync(join(IGNORED_STRAY, '.gitignore'), '*.json\n');
execFileSync('git', ['init', '--quiet'], { cwd: IGNORED_STRAY });

ruleTester().run('seeds-are-sql', seedsAreSql, {
    invalid: [
        // Every stray is named, whatever its extension: two strays, two reports.
        {
            code: 'test("x", () => {});',
            errors: [
                { column: 0, line: 1, messageId: 'notSql' },
                { column: 0, line: 1, messageId: 'notSql' },
            ],
            filename: `${TWO_STRAYS}/specs/app/widget/widget.test.ts`,
        },
        // A file nobody added is still in the tree: it violates like a tracked one.
        {
            code: 'test("x", () => {});',
            errors: [{ column: 0, line: 1, messageId: 'notSql' }],
            filename: `${UNTRACKED_STRAY}/specs/app/widget/widget.test.ts`,
        },
        // The violation fixture keeps a .json next to the .sql.
        {
            code: 'test("x", () => {});',
            errors: [{ column: 0, line: 1, messageId: 'notSql' }],
            filename: `${SPECS_LINT}/seeds-are-sql/_fixtures/violation/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        // Only .sql fragments in the compliant twin.
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/seeds-are-sql/_fixtures/compliant/specs/app/widget/widget.test.ts`,
        },
        // No _seeds/ directory at this level (the feature has no _seeds/ sibling).
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/seeds-are-sql/_fixtures/compliant/specs/app/app.test.ts`,
        },
        // A file `.gitignore` names is on no checkout: it violates nothing.
        {
            code: 'test("x", () => {});',
            filename: `${IGNORED_STRAY}/specs/app/widget/widget.test.ts`,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});

function lintPass(file: string): string[] {
    const reported: string[] = [];
    const context: Pick<Context, 'filename' | 'physicalFilename' | 'report' | 'sourceCode'> = {
        filename: file,
        physicalFilename: file,
        report: (diagnostic) => {
            reported.push(String(diagnostic.data?.entry));
        },
        // A lint of its own: oxlint forgets what a file's lint answered when it ends.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the rule keys its answers on this object and reads nothing of it
        sourceCode: {} as Context['sourceCode'],
    };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `seeds-are-sql` reads only the file's name and `report`; the rest of oxlint's context is not what this pass is about
    const visitor = seedsAreSql.createOnce(context as Context);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `seeds-are-sql` reports on the program node and reads nothing of its span
    const program = { type: 'Program' } as AstNode;
    const { before, Program: enterProgram } = visitor;
    if (before?.() !== false) {
        enterProgram?.(program);
    }
    return reported;
}

describe('seedsAreSql', () => {
    test('seeds-are-sql — the editor lints again in one process — a stray written after a first pass is seen by the second', () => {
        // Given - a git checkout whose _seeds/ holds one `.sql`, linted once
        const root = checkoutUnder('work', ['specs/app/widget/_seeds']);
        writeFileSync(join(root, 'specs/app/widget/_seeds/users.sql'), 'select 1;\n');
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        execFileSync('git', ['add', '.'], { cwd: root });
        const file = join(root, 'specs/app/widget/widget.test.ts');
        expect(lintPass(file)).toStrictEqual([]);

        // When - a stray is written beside it, and nothing restarts the host
        writeFileSync(join(root, 'specs/app/widget/_seeds/users.json'), '[]\n');

        // Then - the next pass reports it
        expect(lintPass(file)).toStrictEqual(['users.json']);
    });
});
