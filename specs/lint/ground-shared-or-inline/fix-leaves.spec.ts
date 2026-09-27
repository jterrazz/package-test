import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('fix-leaves', () => {
    test('--fix leaves a golden a module test reads too a file, and its one test as written', async () => {
        // Given - the module-read-golden tree
        const result = await checker
            .fixture(directory('./_fixtures/module-read-golden/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/notes/_expected/line.txt').exists).toBe(true);
        expect(result.file('specs/notes/line.spec.ts').content).toBe(
            [
                "import { file, text } from '@jterrazz/test';",
                "import { describe, expect, test } from 'vitest';",
                '',
                "describe('line', () => {",
                "test('a golden a module test reads too', () => {",
                '    // Given - the line',
                '    // Then - it matches the golden the module test also reads',
                "    expect(text('one line')).toMatch(file('./_expected/line.txt'));",
                '});',
                '});',
                '',
            ].join('\n'),
        );
    });

    test('--fix leaves a pool fixture a module test names by pieces, and the module test as written', async () => {
        // Given - the module-read-pieces tree
        const result = await checker
            .fixture(directory('./_fixtures/module-read-pieces/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/_shared/_fixtures/lonely-stub/main.js').exists).toBe(true);
        expect(result.file('specs/widget/_fixtures').exists).toBe(false);
        expect(result.file('src/stub/stub.test.ts').content).toBe(
            [
                "import { resolve } from 'node:path';",
                "import { describe, expect, test } from 'vitest';",
                '',
                '/** The stub, named from this module test piece by piece. */',
                "const STUB = resolve(import.meta.dirname, '..', '..', 'specs', '_shared', '_fixtures', 'lonely-stub');",
                '',
                "describe('stub', () => {",
                "test('names the stub', () => {",
                "    // Given - the stub's folder",
                '    // Then - it is named',
                "    expect(STUB).toContain('lonely-stub');",
                '});',
                '});',
                '',
            ].join('\n'),
        );
    });

    test('--fix leaves a pool fixture a module test reads where it is, and the module test as written', async () => {
        // Given - the module-read tree
        const result = await checker
            .fixture(directory('./_fixtures/module-read/'))
            .run({ fix: true });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(result.file('specs/_shared/_fixtures/lonely-stub/main.js').exists).toBe(true);
        expect(result.file('specs/widget/_fixtures').exists).toBe(false);
        expect(result.file('src/stub/stub.test.ts').content).toBe(
            [
                "import { resolve } from 'node:path';",
                "import { describe, expect, test } from 'vitest';",
                '',
                '/** The stub, named from this module test. */',
                "const STUB = resolve(import.meta.dirname, '../../specs/_shared/_fixtures/lonely-stub/');",
                '',
                "describe('stub', () => {",
                "test('names the stub', () => {",
                "    // Given - the stub's folder",
                '    // Then - it is named',
                "    expect(STUB).toContain('lonely-stub');",
                '});',
                '});',
                '',
            ].join('\n'),
        );
    });

    test("--fix never writes a string's comparison to a file, a string having no golden", async () => {
        // Given - the past-cap-string tree
        const result = await checker
            .fixture(directory('./_fixtures/past-cap-string/'))
            .run({ fix: true });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/widget.test.ts:6:29  jterrazz-check(ground-shared-or-inline)
                found: an expectation of 162 lines written in the test, past the _expected/ cap of 150
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: a string has no golden: wrap it — \`expect(text(message)).toMatch(file('./_expected/a-long-message.txt'))\` — or compare the result it came from to its file; by hand: the fixer never writes a string's comparison to a file
                read: docs/19-linting.md#ground-shared-or-inline
        `);
        expect(result.file('specs/widget/_expected').exists).toBe(false);
        expect(result.file('specs/widget/widget.test.ts').content).toContain(
            'expect(message).toMatch(`\n        line 0\n',
        );
    });

    test('--fix writes no file for a value past its cap it cannot read, and leaves the spec as written', async () => {
        // Given - the past-cap-unreadable tree
        const result = await checker
            .fixture(directory('./_fixtures/past-cap-unreadable/'))
            .run({ fix: true });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/users/create/created.spec.ts:10:45  jterrazz-check(ground-shared-or-inline)
                found: a request of 31 lines written in the test, past the _requests/ cap of 30
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to a file under ./_requests/ and name it with file() — by hand: the fixer reads a string, a template or a JSON value only
                read: docs/19-linting.md#ground-shared-or-inline
            specs/api/users/create/created.spec.ts:48:38  jterrazz-check(ground-shared-or-inline)
                found: a request of 33 lines written in the test, past the _requests/ cap of 30
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to a file under ./_requests/ and name it with file() — by hand: the fixer reads a string, a template or a JSON value only
                read: docs/19-linting.md#ground-shared-or-inline
            specs/api/users/create/created.spec.ts:91:33  jterrazz-check(ground-shared-or-inline)
                found: an expectation of 156 lines written in the test, past the _expected/ cap of 150
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to a file under ./_expected/ and name it with file() — by hand: the fixer reads a string, a template or a JSON value only
                read: docs/19-linting.md#ground-shared-or-inline
        `);
        await expect(result.directory()).toMatch(directory('./_expected/past-cap-unreadable/'));
    });
});
