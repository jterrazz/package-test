import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('named-path-exists', () => {
    test("a module test's golden and resolved paths pass; a lone bare piece, a string, a command go unread", async () => {
        // Given - the module-present tree
        const result = await checker
            .fixture(directory('./_fixtures/module-present/'))
            .run({ args: '--member' });

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('every path naming an entry of the kind its wrapper says passes', async () => {
        // Given - the present tree
        const result = await checker.fixture(directory('./_fixtures/present/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('every path a document names is judged where it is written, entry by entry', async () => {
        // Given - the document-missing tree
        const result = await checker.fixture(directory('./_fixtures/document-missing/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/case.spec.yaml:3:1  jterrazz-check(named-path-exists)
                found: fixture: "./_fixtures/shop/" names nothing — widget/_fixtures/shop does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create widget/_fixtures/shop, or correct the path
                read: docs/reference/linting.md#named-path-exists
            specs/widget/case.spec.yaml:4:1  jterrazz-check(named-path-exists)
                found: fixture: "./_fixtures/config.json" names nothing — widget/_fixtures/config.json does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create widget/_fixtures/config.json, or correct the path
                read: docs/reference/linting.md#named-path-exists
        `);
    });

    test('a path a `_shared/_setup/` module names is read, and refused when it names nothing', async () => {
        // Given - the shared-setup tree
        const result = await checker.fixture(directory('./_fixtures/shared-setup/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/_shared/_setup/rows.ts:5:29  jterrazz-check(named-path-exists)
                found: file('../_fixtures/missing.json') names nothing — _shared/_fixtures/missing.json does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create _shared/_fixtures/missing.json, or correct the path
                read: docs/reference/linting.md#named-path-exists
        `);
    });

    test('a module test naming a golden, or a path it resolves, that is not there is refused at the path', async () => {
        // Given - the module-missing tree
        const result = await checker
            .fixture(directory('./_fixtures/module-missing/'))
            .run({ args: '--member' });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/report/report.test.ts:9:48  jterrazz-check(named-path-exists)
                found: './_fixtures/workspace/' names nothing — src/report/_fixtures/workspace does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/_fixtures/workspace, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/report.test.ts:10:21  jterrazz-check(named-path-exists)
                found: './_expected/log.txt' names nothing — src/report/_expected/log.txt does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/_expected/log.txt, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/report.test.ts:13:42  jterrazz-check(named-path-exists)
                found: '_expected', 'x.txt' names nothing — src/report/_expected/x.txt does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/_expected/x.txt, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/report.test.ts:14:46  jterrazz-check(named-path-exists)
                found: '..', '_fixtures', 'gone' names nothing — src/_fixtures/gone does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/_fixtures/gone, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/report.test.ts:15:32  jterrazz-check(named-path-exists)
                found: './_expected/legacy.txt' names nothing — src/report/_expected/legacy.txt does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/_expected/legacy.txt, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/report.test.ts:16:35  jterrazz-check(named-path-exists)
                found: '_seeds', 'rows.sql' names nothing — src/report/_seeds/rows.sql does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/_seeds/rows.sql, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/report.test.ts:25:41  jterrazz-check(named-path-exists)
                found: file('./_expected/total.json') names nothing — src/report/_expected/total.json does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/_expected/total.json, or correct the path
                read: docs/reference/linting.md#named-path-exists
        `);
    });

    test('a path naming nothing, wrapped or built from pieces, or a directory as a file, is refused', async () => {
        // Given - the missing tree
        const result = await checker.fixture(directory('./_fixtures/missing/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/build/build.spec.ts:9:41  jterrazz-check(named-path-exists)
                found: '_expected', 'gone.txt' names nothing — cli/build/_expected/gone.txt does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create cli/build/_expected/gone.txt, or correct the path
                read: docs/reference/linting.md#named-path-exists
            specs/cli/build/build.spec.ts:14:48  jterrazz-check(named-path-exists)
                found: directory('./_fixtures/shop/') names nothing — cli/build/_fixtures/shop does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create cli/build/_fixtures/shop, or correct the path
                read: docs/reference/linting.md#named-path-exists
            specs/cli/build/build.spec.ts:18:40  jterrazz-check(named-path-exists)
                found: file('./_expected/out') names a directory
                why: Every \`file()\` and \`directory()\` a test names with a literal path — a spec under \`specs/\` and a module test beside its module alike — and every path a document's \`fixture:\` names — names an entry that exists — inside a git work tree, one git does not ignore — of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: write directory('./_expected/out/')
                read: docs/reference/linting.md#named-path-exists
        `);
    });
});
