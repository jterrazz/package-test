import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { dedent } from '../matching/dedent.js';
import {
    callSiteOf,
    locateArgument,
    renderRows,
    renderText,
    renderValue,
    writeInPlace,
    writePendingRewrites,
} from './in-place.js';

/** A scratch test file holding `source`, removed when the test ends. */
function scratchFile(source: string): string {
    const directory = mkdtempSync(join(tmpdir(), 'in-place-'));
    const file = join(directory, 'scratch.test.ts');
    writeFileSync(file, source);
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    return file;
}

/** What a rendered value reads as in a test: a quoted line's value, or a template's text, unescaped. */
function readRendered(rendered: string): string {
    const quoted: unknown = rendered.startsWith('"') ? JSON.parse(rendered) : undefined;
    if (typeof quoted === 'string') {
        return quoted;
    }
    return rendered.slice(1, -1).replaceAll(/\\(?<escaped>[\\`$])/gu, '$<escaped>');
}

describe('callSiteOf — the frame of the test that called toMatch', () => {
    test('skips the framework and the dependencies, and reads the first test frame', () => {
        // Given - a stack through the framework's router, vitest, then the test
        const stack = [
            'Error: toMatch call site',
            `    at Proxy.toMatch (${join(import.meta.dirname, '../result/text-assertions.ts')}:163:34)`,
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
});

describe('locateArgument — the value a toMatch call holds', () => {
    test('finds the call the position points at, among several on the line', () => {
        // Given - two calls on one line, the frame pointing at the second name
        const source = "expect(a).toMatch('one'); expect(b).toMatch(`two`, { frozen: true });\n";
        const column = source.lastIndexOf('toMatch') + 1;

        // Then - the second argument, up to its comma
        const span = locateArgument(source, { column, file: 'x', line: 1 });
        expect(source.slice(span?.start, span?.end)).toBe('`two`');
    });

    test('skips what a template, a string or a nested call holds', () => {
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

    test('an empty call is a place to write', () => {
        // Given - a call with nothing in it yet
        const source = 'expect(result.stdout).toMatch();';

        // Then - an empty span just past the parenthesis
        const span = locateArgument(source, { column: 1, file: 'x', line: 1 });
        expect(span?.start).toBe(source.indexOf('()') + 1);
        expect(span?.end).toBe(span?.start);
    });
});

describe('the value written in place reads back as the value', () => {
    test.each([
        ['a line', 'built'],
        ['lines ending on a break', 'HTTP/1.1 200 OK\n\n{"ok": true}\n'],
        ['lines with no final break', 'first\nlast'],
        ['a text opening on a break', '\nafter a blank line\n'],
        ['a backtick, a backslash and a hole', `a \`b\` \\n \${c}\n`],
        ['every line indented', '  a\n  b\n'],
    ])('%s', (_name, text) => {
        // Given - the text rendered at an indentation, and read as a test would
        const read = readRendered(renderText(text, '        '));

        // Then - dedented, it is the text again
        expect(dedent(read)).toBe(text);
    });

    test('a json value and rows are written as code indented with the call', () => {
        // Given - a value and rows at an indentation
        // Then - one line per row, the closing bracket on the call's column
        expect(renderValue({ id: '{{uuid}}', tags: ['a'] }, '    ')).toBe(
            '{\n        "id": "{{uuid}}",\n        "tags": [\n            "a"\n        ]\n    }',
        );
        expect(renderRows([[1, 'Ada', null]], '    ')).toBe('[\n        [1, "Ada", null],\n    ]');
        expect(renderRows([], '    ')).toBe('[]');
    });
});

describe('writeInPlace — the test file rewritten where its toMatch stands', () => {
    test('two rewrites of one file land where each stack says, the first moving the lines of the second', () => {
        // Given - a scratch test whose first value is a block, the second call three lines below it
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

    test('a site holding no toMatch is refused, naming it', () => {
        // Given - a scratch test whose line holds no toMatch
        const file = scratchFile('const x = 1;\n');

        // Then - refused, the file untouched
        expect(() => {
            writeInPlace({ column: 1, file, line: 1 }, () => '``');
        }).toThrow(`update mode: no toMatch( stands at ${file}:1:1`);
        expect(readFileSync(file, 'utf8')).toBe('const x = 1;\n');
    });

    test('with a pending folder the file waits for the run to end, then is written', () => {
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
});
