import { describe, expect, test } from 'vitest';

import {
    parseLiterateFile,
    serializeLiterateBlock,
    serializeLiterateFile,
} from './literate-file.js';

const FILE = 'specs/cli/example.cli';

const HEADER = ['test: a title', 'given: some ground', 'then: an outcome'].join('\n');

const full = [
    '# a comment nobody parses',
    'test: refuses to guess when it is run outside the checkout',
    'given: a workdir with no home/ + apps/ pair anywhere above it',
    'then: the error names where the command has to be run',
    'fixture: $FIXTURES/repositories-stub/',
    'fixture: overlay/',
    'env: frozen TERRA_ORIGIN=http://127.0.0.1:9',
    'serve: mcp MCP_STUB_WITHHOLD=get-article',
    '',
    '$ terra git repositories',
    'exit: 1',
    '--- stderr',
    'Error: no directory with home/ and apps/ above the current directory',
    'Hint: run inside the checkout',
    '',
    '$ terra git repositories --json',
    'exit: 0',
    '{',
    '    "data": []',
    '}',
    '',
].join('\n');

describe('literate-file — header grammar', () => {
    test('reads the narrative, the layered fixtures, the env tokens and the servers', () => {
        // Given - a complete header with every repeatable key used twice-over
        const spec = parseLiterateFile(full, FILE);

        // Then - the three mandatory lines and the ordered repeatables
        expect(spec.header.test).toBe('refuses to guess when it is run outside the checkout');
        expect(spec.header.given).toBe('a workdir with no home/ + apps/ pair anywhere above it');
        expect(spec.header.then).toBe('the error names where the command has to be run');
        expect(spec.header.fixtures).toEqual(['$FIXTURES/repositories-stub/', 'overlay/']);
        expect(spec.header.env).toEqual([
            { kind: 'set', name: 'frozen' },
            { key: 'TERRA_ORIGIN', kind: 'pair', value: 'http://127.0.0.1:9' },
        ]);
        expect(spec.header.serve).toEqual([
            { env: { MCP_STUB_WITHHOLD: 'get-article' }, line: 8, name: 'mcp' },
        ]);
    });

    test('an unknown header key is an error naming the line', () => {
        // Given - a header carrying a key outside the closed set
        const source = `${HEADER}\nwhen: something\n\n$ run\nexit: 0\n`;

        // Then - the message points at the line and lists the vocabulary
        expect(() => parseLiterateFile(source, FILE)).toThrow(
            `${FILE}:4: unknown header key "when:"`,
        );
    });

    test('a missing mandatory line is an error naming what B4 wants', () => {
        // Given - a header without `then:`
        const source = 'test: a title\ngiven: some ground\n\n$ run\nexit: 0\n';

        // Then - the message names the key B4 asks every test for
        expect(() => parseLiterateFile(source, FILE)).toThrow('missing "then:" in the header');
    });

    test('a header line that is not `key: value` is an error', () => {
        // Given - a stray prose line inside the header
        const source = `${HEADER}\njust prose\n\n$ run\nexit: 0\n`;

        // Then - the line is quoted back, with the shape it should have had
        expect(() => parseLiterateFile(source, FILE)).toThrow(
            `${FILE}:4: "just prose" is not a header line`,
        );
    });

    test('a repeated single-line key is an error', () => {
        // Given - two `test:` lines
        const source = `${HEADER}\ntest: again\n\n$ run\nexit: 0\n`;

        // Then - a single-line key takes exactly one line
        expect(() => parseLiterateFile(source, FILE)).toThrow('test: is declared twice');
    });
});

describe('literate-file — block grammar', () => {
    test('splits blocks on `$`, keeps stdout verbatim and reads the stderr section', () => {
        // Given - the two-block example
        const spec = parseLiterateFile(full, FILE);

        // Then - each block carries its argv, exit code, streams and source line
        expect(spec.blocks).toHaveLength(2);
        expect(spec.blocks[0]).toEqual({
            argv: 'terra git repositories',
            exitCode: 1,
            line: 10,
            stderr:
                'Error: no directory with home/ and apps/ above the current directory\n' +
                'Hint: run inside the checkout',
            stdout: '',
        });
        expect(spec.blocks[1].stdout).toBe('{\n    "data": []\n}');
        expect(spec.blocks[1].stderr).toBeNull();
    });

    test('the blank line before a `$` belongs to the separator, not to the stream', () => {
        // Given - two blocks whose first stdout ends on a real blank line
        const source = `${HEADER}\n\n$ one\nexit: 0\nline\n\nafter blank\n\n$ two\nexit: 0\n`;

        // Then - the inner blank line survives; only the separator is dropped
        const spec = parseLiterateFile(source, FILE);
        expect(spec.blocks[0].stdout).toBe('line\n\nafter blank');
        expect(spec.blocks[1].stdout).toBe('');
    });

    test('a missing `exit:` line is an error naming the command', () => {
        // Given - a block whose second line is output, not an exit code
        const source = `${HEADER}\n\n$ run\nhello\n`;

        // Then - the refusal names the command whose exit code is missing
        expect(() => parseLiterateFile(source, FILE)).toThrow(
            'the line after "$ run" must be "exit: <integer>", got "hello"',
        );
    });

    test('a file with no block is an error', () => {
        // Given - a header and nothing else
        const source = `${HEADER}\n\n`;

        // Then - a scenario that runs nothing proves nothing
        expect(() => parseLiterateFile(source, FILE)).toThrow('no "$ <command>" block');
    });

    test('a line before the first `$` is an error', () => {
        // Given - prose between the header and the first block
        const source = `${HEADER}\n\nstray\n$ run\nexit: 0\n`;

        // Then - every body line belongs to a block
        expect(() => parseLiterateFile(source, FILE)).toThrow('sits outside a block');
    });
});

describe('literate-file — serialization', () => {
    test('round-trips: parsing the serialized form gives the same blocks', () => {
        // Given - the parsed example
        const spec = parseLiterateFile(full, FILE);

        // Then - re-serialized and re-parsed, the header text and blocks hold
        const written = serializeLiterateFile(spec.headerText, spec.blocks);
        const again = parseLiterateFile(written, FILE);
        expect(again.blocks).toEqual(spec.blocks);
        expect(again.headerText).toBe(spec.headerText);
    });

    test('an empty stderr renders no `--- stderr` section', () => {
        // Given - a block with output and no error stream
        const rendered = serializeLiterateBlock({
            argv: 'run',
            exitCode: 0,
            line: 1,
            stderr: '',
            stdout: 'ok',
        });

        // Then - an empty stream leaves no section behind
        expect(rendered).toBe('$ run\nexit: 0\nok');
    });
});
