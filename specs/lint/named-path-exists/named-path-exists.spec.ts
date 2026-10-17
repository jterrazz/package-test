import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('named-path-exists', () => {
    test("a module test's golden and resolved paths pass; a lone bare piece, a string, a command go unread", async () => {
        // Given - the module-present tree
        const result = await checker
            .fixture(directory('./__fixtures__/module-present/'))
            .run({ args: '--member' });

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('every path naming an entry of the kind its wrapper says passes', async () => {
        // Given - the present tree
        const result = await checker.fixture(directory('./__fixtures__/present/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('every path a document names is judged where it is written, entry by entry', async () => {
        // Given - the document-missing tree
        const result = await checker.fixture(directory('./__fixtures__/document-missing/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/case.spec.yaml:3:1  jterrazz-check(named-path-exists)
                found: fixture: "./__fixtures__/shop/" names nothing: widget/__fixtures__/shop does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create widget/__fixtures__/shop, or correct the path
                read: docs/reference/linting.md#named-path-exists
            specs/widget/case.spec.yaml:4:1  jterrazz-check(named-path-exists)
                found: fixture: "./__fixtures__/config.json" names nothing: widget/__fixtures__/config.json does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create widget/__fixtures__/config.json, or correct the path
                read: docs/reference/linting.md#named-path-exists
        `);
    });

    test('a path a `__setup__/` module names is read, and refused when it names nothing', async () => {
        // Given - the shared-setup tree
        const result = await checker.fixture(directory('./__fixtures__/shared-setup/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/__setup__/rows.ts:5:29  jterrazz-check(named-path-exists)
                found: file('../__fixtures__/missing.json') names nothing: __fixtures__/missing.json does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create __fixtures__/missing.json, or correct the path
                read: docs/reference/linting.md#named-path-exists
        `);
    });

    test('a module test naming a golden, or a path it resolves, that is not there is refused at the path', async () => {
        // Given - the module-missing tree
        const result = await checker
            .fixture(directory('./__fixtures__/module-missing/'))
            .run({ args: '--member' });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/report/__tests__/report.test.ts:9:48  jterrazz-check(named-path-exists)
                found: './__fixtures__/workspace/' names nothing: src/report/__tests__/__fixtures__/workspace does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/__tests__/__fixtures__/workspace, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/__tests__/report.test.ts:10:21  jterrazz-check(named-path-exists)
                found: './__expected__/log.txt' names nothing: src/report/__tests__/__expected__/log.txt does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/__tests__/__expected__/log.txt, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/__tests__/report.test.ts:13:42  jterrazz-check(named-path-exists)
                found: '__expected__', 'x.txt' names nothing: src/report/__tests__/__expected__/x.txt does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/__tests__/__expected__/x.txt, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/__tests__/report.test.ts:14:46  jterrazz-check(named-path-exists)
                found: '..', '..', '__fixtures__', 'gone' names nothing: src/__fixtures__/gone does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/__fixtures__/gone, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/__tests__/report.test.ts:15:32  jterrazz-check(named-path-exists)
                found: './__expected__/legacy.txt' names nothing: src/report/__tests__/__expected__/legacy.txt does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/__tests__/__expected__/legacy.txt, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/__tests__/report.test.ts:16:35  jterrazz-check(named-path-exists)
                found: '__seeds__', 'rows.sql' names nothing: src/report/__tests__/__seeds__/rows.sql does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/__tests__/__seeds__/rows.sql, or correct the path
                read: docs/reference/linting.md#named-path-exists
            src/report/__tests__/report.test.ts:25:41  jterrazz-check(named-path-exists)
                found: file('./__expected__/total.json') names nothing: src/report/__tests__/__expected__/total.json does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create src/report/__tests__/__expected__/total.json, or correct the path
                read: docs/reference/linting.md#named-path-exists
        `);
    });

    test('a path naming nothing, wrapped or built from pieces, or a directory as a file, is refused', async () => {
        // Given - the missing tree
        const result = await checker.fixture(directory('./__fixtures__/missing/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/build/build.spec.ts:9:41  jterrazz-check(named-path-exists)
                found: '__expected__', 'gone.txt' names nothing: cli/build/__expected__/gone.txt does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create cli/build/__expected__/gone.txt, or correct the path
                read: docs/reference/linting.md#named-path-exists
            specs/cli/build/build.spec.ts:14:48  jterrazz-check(named-path-exists)
                found: directory('./__fixtures__/shop/') names nothing: cli/build/__fixtures__/shop does not exist
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: create cli/build/__fixtures__/shop, or correct the path
                read: docs/reference/linting.md#named-path-exists
            specs/cli/build/build.spec.ts:18:40  jterrazz-check(named-path-exists)
                found: file('./__expected__/out') names a directory
                why: Every \`file()\` and \`directory()\` a test names with a literal path (a spec under \`specs/\` and a module test in its \`__tests__/\` alike), and every path a document's \`fixture:\` names, names an entry that exists inside a git work tree, one git does not ignore, of the kind the wrapper says, resolved from the test file's directory: a missing or ignored path, a \`file()\` naming a directory or a \`directory()\` naming a file is an error, reported where the path is written.
                fix: write directory('./__expected__/out/')
                read: docs/reference/linting.md#named-path-exists
        `);
    });
});
