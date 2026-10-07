import { describe, expect, test } from 'vitest';

import { assertedStreams, documentPaths, parseSpecDocument } from '../spec-document.js';
import { DOCUMENT_KEYS, RUN_KEYS } from '../spec-grammar.js';
import { MINIMAL, refusalOf, REFUSALS, SERVING } from './spec-document.fixtures.js';

describe('spec-document', () => {
    test('spec document — reading — a minimal document asserts empty streams', () => {
        // Given - the smallest document the grammar accepts
        const document = parseSpecDocument(MINIMAL, 'case.spec.yaml');

        // Then - an absent stream is `null` (= empty)
        expect(document.description).toBe('does the thing');
        expect(document.runs).toHaveLength(1);
        expect(document.runs[0]?.stdout).toBeNull();
        expect(document.runs[0]?.stderr).toBeNull();
        expect(document.runs[0]?.files).toStrictEqual([]);
    });

    test('spec document — reading — a block scalar keeps its final newline; `|-` drops it', () => {
        // Given - the two chomping forms, side by side
        const document = parseSpecDocument(
            [
                'description: two chomping forms',
                'runs:',
                '  - command: a',
                '    exit: 0',
                '    stdout: |',
                '      kept',
                '  - command: b',
                '    exit: 0',
                '    stdout: |-',
                '      dropped',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - the comparison text is byte-exact, trailing newline included
        expect(document.runs[0]?.stdout?.text).toBe('kept\n');
        expect(document.runs[1]?.stdout?.text).toBe('dropped');
    });

    test('spec document — reading — a stream reports the line its CONTENT starts on, not the key line', () => {
        // Given - `stdout: |` on line 5, its first content line on line 6
        const document = parseSpecDocument(
            [
                'description: locates its streams',
                'runs:',
                '  - command: a',
                '    exit: 0',
                '    stdout: |',
                '      first',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - a defect inside the stream is reported where the reader sees it
        expect(document.runs[0]?.stdout?.line).toBe(6);
        expect(document.runs[0]?.commandLine).toBe(3);
    });

    test.each(['$FIXTURES/stub/', 'stub/', '/abs/stub/'])(
        'spec document — reading — a fixture that is not a relative path is refused on its line: %s',
        (path) => {
            // Given - a marker, a bare name, an absolute path
            const source = [
                'description: states its ground',
                'fixture:',
                `  - ${path}`,
                'runs:',
                '  - command: help',
                '    exit: 0',
                '',
            ].join('\n');

            // Then - refused by the grammar, where the path is written
            expect(() => parseSpecDocument(source, 'case.spec.yaml')).toThrow(
                /^case\.spec\.yaml:3: fixture: ".*" is not a relative path — name it from this document/u,
            );
        },
    );

    test.each([
        ['./__expected__/tree/', 'names __expected__/'],
        ['./tree/', 'names no __fixtures__/ folder'],
        ['./__seeds__/__fixtures__/tree/', 'names __seeds__/'],
    ])(
        'spec document — reading — a fixture whose first ground folder is not __fixtures__/ is refused on its line (`verb-reads-its-ground-folder`): %s',
        (path, names) => {
            // Given - a path whose first ground folder is another role's, or none
            const source = [
                'description: states its ground',
                `fixture: ${path}`,
                'runs:',
                '  - command: help',
                '    exit: 0',
                '',
            ].join('\n');

            // Then - the first ground folder is the one judged, as for every other path key
            expect(() => parseSpecDocument(source, 'case.spec.yaml')).toThrow(
                `case.spec.yaml:2: fixture: reads __fixtures__/, and "${path}" ${names} — put the file in ./__fixtures__/ beside the document, or in the __fixtures__/ of the lowest folder the leaves share (specs/__fixtures__/ across specifications) (verb-reads-its-ground-folder)`,
            );
        },
    );

    test.each(['./__fixtures__/', './__fixtures__/tree/', '../../__fixtures__/__seeds__/one.sql'])(
        'spec document — reading — a fixture whose first ground folder is __fixtures__/ is read: %s',
        (path) => {
            // Given - file state named through __fixtures__/, whatever it holds below
            const source = [
                'description: states its ground',
                `fixture: ${path}`,
                'runs:',
                '  - command: help',
                '    exit: 0',
                '',
            ].join('\n');

            // Then - the path is kept as written
            expect(parseSpecDocument(source, 'case.spec.yaml').fixtures).toMatchObject([{ path }]);
        },
    );

    test('spec document — reading — env and fixture take a bare string or a list, and serve carries extra env', () => {
        // Given - the three ground keys in both their forms
        const document = parseSpecDocument(
            [
                'description: states its ground',
                'fixture: ../../__fixtures__/stub/',
                'env:',
                '  - frozen',
                '  - ORIGIN=http://127.0.0.1:9',
                'serve:',
                '  - dashboard',
                '  - mcp: { MCP_STUB_WITHHOLD: get-article }',
                'runs:',
                '  - command: help',
                '    exit: 0',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - a bare word is a registered set, KEY=value is inline, and a mapping entry names one server plus the env it is started with
        expect(document.fixtures.map((fixture) => fixture.path)).toStrictEqual([
            '../../__fixtures__/stub/',
        ]);
        expect(document.env).toStrictEqual([
            { kind: 'set', line: 4, name: 'frozen' },
            { key: 'ORIGIN', kind: 'pair', line: 5, value: 'http://127.0.0.1:9' },
        ]);
        expect(document.serve).toStrictEqual([
            { env: {}, line: 7, name: 'dashboard' },
            { env: { MCP_STUB_WITHHOLD: 'get-article' }, line: 8, name: 'mcp' },
        ]);
    });

    test('spec document — reading — files: reads all four forms of an on-disk assertion', () => {
        // Given - contains (one and many), equals, and the two bare states
        const document = parseSpecDocument(
            [
                'description: reads what was written',
                'runs:',
                '  - command: build',
                '    exit: 0',
                '    files:',
                '      one.txt: { contains: hi }',
                '      many.txt: { contains: [a, b] }',
                '      exact.txt: { equals: "x" }',
                '      gone: absent',
                '      here: exists',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - each entry keeps its path and its kind
        expect(document.runs[0]?.files.map((file) => [file.path, file.kind])).toStrictEqual([
            ['one.txt', 'content'],
            ['many.txt', 'content'],
            ['exact.txt', 'content'],
            ['gone', 'absent'],
            ['here', 'exists'],
        ]);
    });

    test('spec document — refusals — an unknown top-level key names the key and its line', () => {
        // Given - a `given:` line, which this grammar does not know
        const refusal = refusalOf(
            `description: x\ngiven: something\nruns:\n  - command: a\n    exit: 0\n`,
        );

        // Then - the closed vocabulary is spelled out, on the offending line
        expect(refusal.line).toBe(2);
        expect(refusal.message).toContain('unknown key "given:"');
        expect(refusal.message).toContain(DOCUMENT_KEYS.join(', '));
    });

    test('spec document — refusals — an unknown run key names the run vocabulary', () => {
        // Given - a run carrying `stdouts:`
        const refusal = refusalOf(
            `description: x\nruns:\n  - command: a\n    exit: 0\n    stdouts: y\n`,
        );

        // Then - the run's own closed set is named
        expect(refusal.line).toBe(5);
        expect(refusal.message).toContain('unknown key "stdouts:" in a run');
        expect(refusal.message).toContain(RUN_KEYS.join(', '));
    });

    test('spec document — refusals — a missing description is refused, and so is a missing exit', () => {
        // Given - each mandatory key removed in turn
        // Then - the refusal names what the grammar demands
        expect(refusalOf('runs:\n  - command: a\n    exit: 0\n').message).toContain(
            'missing "description:"',
        );
        expect(refusalOf('description: x\nruns:\n  - command: a\n').message).toContain(
            'missing "exit:"',
        );
    });

    test('spec document — refusals — exit must be a literal integer', () => {
        // Given - a quoted exit code
        const refusal = refusalOf(`description: x\nruns:\n  - command: a\n    exit: "0"\n`);

        // Then - the grammar refuses the string form rather than coercing it
        expect(refusal.message).toContain('exit: must be a literal integer');
    });

    test('spec document — refusals — waitFor is refused on any run but the last', () => {
        // Given - a long-running first run followed by a second
        const refusal = refusalOf(
            `description: x\nruns:\n  - command: serve\n    exit: 0\n    waitFor: listening\n  - command: b\n    exit: 0\n`,
        );

        // Then - the run after it would never start
        expect(refusal.message).toContain('waitFor: is only allowed on the LAST run');
    });

    test('spec document — refusals — a kind is no key: an api or job case is a TypeScript spec', () => {
        // Given - a document stating the kind the grammar once read
        const refusal = refusalOf(
            `kind: api\ndescription: x\nruns:\n  - command: a\n    exit: 0\n`,
        );

        // Then - refused as the unknown key it is
        expect(refusal.message).toContain('unknown key "kind:" in a spec document');
    });

    test('spec document — refusals — malformed YAML is refused with the parser’s own line', () => {
        // Given - a document that is not YAML at all
        const refusal = refusalOf('description: x\n  runs: [\n');

        // Then - the refusal carries a line, not a stack
        expect(refusal.line).toBeGreaterThan(0);
        expect(refusal.name).toBe('SpecSyntaxError');
    });

    test.each(REFUSALS)('spec document — refusals — %s is refused whole', (_, content, message) => {
        // Given - a document of that shape
        // Then - the refusal, file and line first
        expect(refusalOf(content).message).toBe(message);
    });

    test('spec document — reading — the last run may wait, a document names its description line, its fixtures and the streams it asserts', () => {
        // Given - a two-run document, the last one waiting, with a fixture of each kind and streams of each kind
        const document = parseSpecDocument(SERVING, 'case.spec.yaml');

        // Then - what each reader of the document needs
        expect([
            document.descriptionLine,
            documentPaths(document),
            assertedStreams(document).map(({ text }) => text),
            parseSpecDocument(MINIMAL, 'case.spec.yaml').fixtures,
        ]).toStrictEqual([
            2,
            [
                { key: 'fixture', kind: 'directory', line: 3, path: './__fixtures__/tree/' },
                { key: 'fixture', kind: 'file', line: 3, path: './__fixtures__/one.sql' },
            ],
            ['out', 'needle', 'whole', 'other', 'err'],
            [],
        ]);
    });
});
