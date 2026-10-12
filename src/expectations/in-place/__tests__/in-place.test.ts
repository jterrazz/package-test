import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, inject, onTestFinished, test } from 'vitest';

import { registerMatchers } from '../../goldens/matchers.js';
import {
    callSiteOf,
    deferRewritesTo,
    locateArgument,
    writeInPlace,
    writePendingRewrites,
} from '../in-place.js';
import { renderText, renderValue } from '../render.js';

function scratchFile(source: string): string {
    const directory = mkdtempSync(join(tmpdir(), 'in-place-'));
    const file = join(directory, 'scratch.test.ts');
    writeFileSync(file, source);
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    return file;
}

// invariant: a worker's files share the module graph, so a file that registered the matchers left the writes deferred: a test reading its file back writes at once.
function writeImmediately(): void {
    deferRewritesTo(null);
    onTestFinished(() => {
        deferRewritesTo(() => inject('inPlaceRewrites'));
    });
}

describe('in-place', () => {
    test('callSiteOf — the frame of the test that called toMatch — skips the framework and the dependencies, and reads the first test frame', () => {
        // Given - a stack through the framework's router, vitest, then the test
        const stack = [
            'Error: toMatch call site',
            `    at Proxy.toMatch (${join(import.meta.dirname, 'text-assertions.ts')}:163:34)`,
            '    at file:///repo/node_modules/@vitest/expect/dist/index.js:1:2',
            '    at /work/specs/api/users/users.spec.ts:12:33',
        ].join('\n');

        // Then - the test's own line and column
        expect(callSiteOf(stack)).toStrictEqual({
            column: 33,
            file: '/work/specs/api/users/users.spec.ts',
            line: 12,
        });
        expect(callSiteOf('Error: nothing')).toBeUndefined();
    });

    test('locateArgument — the value a toMatch call holds — finds the call the position points at, among several on the line', () => {
        // Given - two calls on one line, the frame pointing at the second name
        const source = "expect(a).toMatch('one'); expect(b).toMatch(`two`, { frozen: true });\n";
        const column = source.lastIndexOf('toMatch') + 1;

        // Then - the second argument, up to its comma, whether the frame names the call or its parenthesis
        const spans = [column, column + 'toMatch'.length].map((at) =>
            locateArgument(source, { column: at, file: 'x', line: 1 }),
        );
        expect(spans.map((span) => source.slice(span?.start, span?.end))).toStrictEqual([
            '`two`',
            '`two`',
        ]);
    });

    test('locateArgument — the value a toMatch call holds — skips what a template, a string or a nested call holds', () => {
        // Given - an argument holding a hole, a comma inside a string and a nested call
        const source = [
            '    expect(result.json).toMatch({',
            `        name: \`a \${f(', ')}\`,`,
            "        tags: [g('x', 'y')],",
            '    });',
        ].join('\n');

        // Then - the whole object, and the call line's indentation
        const span = locateArgument(source, { column: 5, file: 'x', line: 1 });
        expect(source.slice(span?.start, span?.end)).toBe(
            `{\n        name: \`a \${f(', ')}\`,\n        tags: [g('x', 'y')],\n    }`,
        );
        expect(span?.indent).toBe('    ');
    });

    test('locateArgument — the value a toMatch call holds — an empty call is a place to write', () => {
        // Given - a call with nothing in it yet
        const source = 'expect(result.stdout).toMatch();';

        // Then - an empty span just past the parenthesis
        const span = locateArgument(source, { column: 1, file: 'x', line: 1 });
        expect(span?.start).toBe(source.indexOf('()') + 1);
        expect(span?.end).toBe(span?.start);
    });

    test('writeInPlace — the test file rewritten where its toMatch stands — two rewrites of one file land where each stack says, the first moving the lines of the second', () => {
        // Given - a scratch test whose first value is a block, the second call three lines below it, written at once
        writeImmediately();
        const source = [
            "test('records', () => {",
            '    expect(one).toMatch(`',
            '        stale',
            '        lines',
            '    `);',
            '    expect(two).toMatch(``);',
            '    expect(three).toMatch(``);',
            '});',
            '',
        ].join('\n');
        const file = scratchFile(source);

        // When - the block shrinks to one line, then the two calls below it are written
        writeInPlace({ column: 17, file, line: 2 }, (indent) => renderText('first', indent));
        writeInPlace({ column: 17, file, line: 6 }, (indent) => renderText('second', indent));
        writeInPlace({ column: 19, file, line: 7 }, (indent) => renderText('third', indent));

        // Then - each value where its call stands, though the lines moved under the stacks
        expect(readFileSync(file, 'utf8')).toBe(
            [
                "test('records', () => {",
                '    expect(one).toMatch(`first`);',
                '    expect(two).toMatch(`second`);',
                '    expect(three).toMatch(`third`);',
                '});',
                '',
            ].join('\n'),
        );
    });

    test('writeInPlace — the test file rewritten where its toMatch stands — a site holding no toMatch is refused, naming it', () => {
        // Given - a scratch test whose line holds no toMatch
        const file = scratchFile('const x = 1;\n');

        // Then - refused, the file untouched
        expect(() => {
            writeInPlace({ column: 1, file, line: 1 }, () => '``');
        }).toThrow(
            [
                `found: update mode: no toMatch( stands at ${file}:1:1 — the value in place cannot be written`,
                'why: A value written in place is rewritten where its `toMatch(` stands.',
                'fix: call `.toMatch(` on the expect() written at that line, not through an alias',
                'read: docs/reference/tokens.md#a-value-written-in-place-is-rewritten-in-the-test',
            ].join('\n'),
        );
        expect(readFileSync(file, 'utf8')).toBe('const x = 1;\n');
    });

    test('writeInPlace — the test file rewritten where its toMatch stands — a name or a call is refused, a literal of any shape written', () => {
        // Given - a scratch test whose calls hold a variable, a call, and every literal shape
        writeImmediately();
        const file = scratchFile(
            [
                'expect(a).toMatch(row.expected);',
                'expect(b).toMatch(expected());',
                'expect(c).toMatch({ id: 1 });',
                'expect(d).toMatch([1]);',
                "expect(e).toMatch('text');",
                'expect(f).toMatch(`text`);',
                'expect(g).toMatch(-1);',
                'expect(h).toMatch(null);',
                'expect(i).toMatch(true);',
                'expect(j).toMatch(undefined);',
                'expect(k).toMatch(nullable);',
                '',
            ].join('\n'),
        );
        const attempt = (line: number): string | undefined => {
            try {
                writeInPlace({ column: 14, file, line }, () => '0');
            } catch (error) {
                return error instanceof Error ? error.message.split('\n')[0] : undefined;
            }
            return undefined;
        };

        // When - each line is written
        const outcomes = Array.from({ length: 11 }, (_, index) => attempt(index + 1));

        // Then - a variable, a call and a name that only starts like a keyword are refused, naming what they hold; every literal is rewritten
        expect(outcomes).toStrictEqual([
            `found: update mode: toMatch(row.expected) at ${file}:1:14 holds a name or a call, not a literal`,
            `found: update mode: toMatch(expected()) at ${file}:2:14 holds a name or a call, not a literal`,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            `found: update mode: toMatch(nullable) at ${file}:11:14 holds a name or a call, not a literal`,
        ]);
    });

    test('writeInPlace — the test file rewritten where its toMatch stands — a name is refused whole, and an empty expectation is written like any other', () => {
        // Given - a scratch test whose first call holds a variable and whose second holds nothing yet
        writeImmediately();
        const file = scratchFile('expect(a).toMatch(row.expected);\nexpect(b).toMatch();\n');

        // When - each is written
        const attempt = (line: number): string | undefined => {
            try {
                writeInPlace({ column: 14, file, line }, () => '0');
            } catch (error) {
                return error instanceof Error ? error.message : undefined;
            }
            return undefined;
        };

        // Then - the variable is refused with its four parts, the empty call is rewritten
        expect([attempt(1), attempt(2)]).toStrictEqual([
            [
                `found: update mode: toMatch(row.expected) at ${file}:1:14 holds a name or a call, not a literal`,
                'why: Update mode rewrites the literal a `toMatch(` holds; a variable stands for values the rewrite would replace by the last one it saw.',
                'fix: write the expectation as a literal in `toMatch(`, or record it by hand: a table’s rows are recorded one by one, never from the last row',
                'read: docs/reference/tokens.md#a-value-written-in-place-is-rewritten-in-the-test',
            ].join('\n'),
            undefined,
        ]);
    });

    test('writeInPlace — the test file rewritten where its toMatch stands — with a pending folder the file waits for the run to end, then is written', () => {
        // Given - a scratch test, and a pending folder for the run
        const file = scratchFile('expect(one).toMatch(``);\n');
        const folder = join(file, '..', 'pending');

        // When - a value is written in place
        writeInPlace(
            { column: 13, file, line: 1 },
            (indent) => renderText('first', indent),
            folder,
        );

        // Then - the test file is untouched until the pending rewrites are written, and none is left waiting
        expect(readFileSync(file, 'utf8')).toBe('expect(one).toMatch(``);\n');
        writePendingRewrites(folder);
        expect(readFileSync(file, 'utf8')).toBe('expect(one).toMatch(`first`);\n');
        expect(existsSync(folder)).toBe(false);
    });

    test('writePendingRewrites — the pending rewrites of a run — each pending file written once, what is no rewrite skipped, a folder never made left alone', () => {
        // Given - two values written to one file and one to another, beside files no rewrite left
        const file = scratchFile('expect(one).toMatch(``);\nexpect(two).toMatch(``);\n');
        const other = join(file, '..', 'other.test.ts');
        writeFileSync(other, 'expect(three).toMatch(``);\n');
        const folder = join(file, '..', 'pending');
        writeInPlace(
            { column: 13, file, line: 1 },
            (indent) => renderText('first', indent),
            folder,
        );
        writeInPlace(
            { column: 13, file, line: 2 },
            (indent) => renderText('second', indent),
            folder,
        );
        writeInPlace(
            { column: 15, file: other, line: 1 },
            (indent) => renderText('third', indent),
            folder,
        );
        writeFileSync(join(folder, 'notes.txt'), 'not json');
        for (const [name, junk] of Object.entries({
            list: [file, 'x'],
            nothing: null,
            numbered: { file: -5, source: 'x' },
            partial: { file },
            text: 'text',
            unwritable: { file, source: 1 },
        })) {
            writeFileSync(join(folder, `${name}.json`), JSON.stringify(junk));
        }

        // When - the run ends, then a run that left nothing ends
        writePendingRewrites(folder);
        writePendingRewrites(join(folder, 'never-made'));

        // Then - both files hold their values, and the folder is gone
        expect([
            readFileSync(file, 'utf8'),
            readFileSync(other, 'utf8'),
            existsSync(folder),
        ]).toStrictEqual([
            'expect(one).toMatch(`first`);\nexpect(two).toMatch(`second`);\n',
            'expect(three).toMatch(`third`);\n',
            false,
        ]);
    });

    test('writePendingRewrites — the pending rewrites of a run — lays each rewritten file out by the oxfmt its project installs', () => {
        // Given - a value written as JSON into a test of a project holding this repository's oxfmt
        const file = scratchFile('expect(one).toMatch(``);\n');
        const binaries = join(file, '..', 'node_modules', '.bin');
        mkdirSync(binaries, { recursive: true });
        symlinkSync(
            resolve(import.meta.dirname, '../../../../node_modules/.bin/oxfmt'),
            join(binaries, 'oxfmt'),
        );
        const folder = join(file, '..', 'pending');
        writeInPlace(
            { column: 13, file, line: 1 },
            (indent) => renderValue({ id: 'x' }, indent),
            folder,
        );

        // When - the run ends
        writePendingRewrites(folder);

        // Then - the value reads as the formatter writes it, its keys bare and its statement closed
        expect(readFileSync(file, 'utf8')).toBe('expect(one).toMatch({\n  id: "x",\n});\n');
    });

    test('deferRewritesTo — the folder update mode leaves a write in — read at each write, and the run’s own once the matchers are registered', async () => {
        // Given - a scratch test, a folder of this test's own, then the matchers registered afresh
        const file = scratchFile('expect(one).toMatch(``);\n');
        const folder = join(file, '..', 'deferred');
        const pending = `${createHash('sha256').update(file).digest('hex')}.json`;
        const runs = join(inject('inPlaceRewrites') ?? folder, pending);
        onTestFinished(() => {
            rmSync(runs, { force: true });
            deferRewritesTo(() => inject('inPlaceRewrites'));
        });

        // When - one write is deferred to the folder, then one after a fresh registration
        deferRewritesTo(() => folder);
        writeInPlace({ column: 13, file, line: 1 }, (indent) => renderText('first', indent));
        Reflect.set(globalThis, Symbol.for('@jterrazz/test:matchers-registered'), false);
        await registerMatchers();
        writeInPlace({ column: 13, file, line: 1 }, (indent) => renderText('second', indent));

        // Then - the test file is untouched, the first write waits in the folder, the second in the run’s
        expect([
            readFileSync(file, 'utf8'),
            existsSync(join(folder, pending)),
            existsSync(runs),
        ]).toStrictEqual(['expect(one).toMatch(``);\n', true, true]);
    });
});
