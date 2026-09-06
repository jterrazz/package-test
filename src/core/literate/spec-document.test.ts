import { describe, expect, test } from 'vitest';

import {
    DOCUMENT_KEYS,
    parseSpecDocument,
    readSpecFile,
    RUN_KEYS,
    SPEC_SCHEMA,
    type SpecSyntaxError,
    updateSpecFile,
} from './spec-document.js';

/**
 * The grammar, read on its own — no runner, no filesystem. Everything here is
 * text in, structure out (or a refusal naming a key and a line).
 */

const MINIMAL = [
    'description: does the thing',
    'runs:',
    '  - command: help',
    '    exit: 0',
    '',
].join('\n');

function refusalOf(content: string): SpecSyntaxError {
    try {
        parseSpecDocument(content, 'case.spec.yaml');
    } catch (error) {
        return error as SpecSyntaxError;
    }
    throw new Error('expected the document to be refused, but it parsed');
}

describe('spec document — reading', () => {
    test('a minimal document defaults its kind and asserts empty streams', () => {
        // Given - the smallest document the grammar accepts
        const document = parseSpecDocument(MINIMAL, 'case.spec.yaml');

        // Then - kind defaults to cli, and an absent stream is `null` (= empty)
        expect(document.kind).toBe('cli');
        expect(document.description).toBe('does the thing');
        expect(document.runs).toHaveLength(1);
        expect(document.runs[0].stdout).toBeNull();
        expect(document.runs[0].stderr).toBeNull();
        expect(document.runs[0].files).toEqual([]);
    });

    test('a block scalar keeps its final newline; `|-` drops it', () => {
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
        expect(document.runs[0].stdout?.text).toBe('kept\n');
        expect(document.runs[1].stdout?.text).toBe('dropped');
    });

    test('a stream reports the line its CONTENT starts on, not the key line', () => {
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
        expect(document.runs[0].stdout?.line).toBe(6);
        expect(document.runs[0].commandLine).toBe(3);
    });

    test('env and fixture take a bare string or a list, and serve carries extra env', () => {
        // Given - the three ground keys in both their forms
        const document = parseSpecDocument(
            [
                'description: states its ground',
                'fixture: $FIXTURES/stub/',
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

        // Then - a bare word is a registered set, KEY=value is inline, and a
        // Mapping entry names one server plus the env it is started with
        expect(document.fixtures.map((fixture) => fixture.path)).toEqual(['$FIXTURES/stub/']);
        expect(document.env).toEqual([
            { kind: 'set', line: 4, name: 'frozen' },
            { key: 'ORIGIN', kind: 'pair', line: 5, value: 'http://127.0.0.1:9' },
        ]);
        expect(document.serve).toEqual([
            { env: {}, line: 7, name: 'dashboard' },
            { env: { MCP_STUB_WITHHOLD: 'get-article' }, line: 8, name: 'mcp' },
        ]);
    });

    test('files: reads all four forms of an on-disk assertion', () => {
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
        expect(document.runs[0].files.map((file) => [file.path, file.kind])).toEqual([
            ['one.txt', 'content'],
            ['many.txt', 'content'],
            ['exact.txt', 'content'],
            ['gone', 'absent'],
            ['here', 'exists'],
        ]);
    });
});

describe('spec document — refusals', () => {
    test('an unknown top-level key names the key and its line', () => {
        // Given - a `given:` line, which this grammar does not know
        const refusal = refusalOf(
            `description: x\ngiven: something\nruns:\n  - command: a\n    exit: 0\n`,
        );

        // Then - the closed vocabulary is spelled out, on the offending line
        expect(refusal.line).toBe(2);
        expect(refusal.message).toContain('unknown key "given:"');
        expect(refusal.message).toContain(DOCUMENT_KEYS.join(', '));
    });

    test('an unknown run key names the run vocabulary', () => {
        // Given - a run carrying `stdouts:`
        const refusal = refusalOf(
            `description: x\nruns:\n  - command: a\n    exit: 0\n    stdouts: y\n`,
        );

        // Then - the run's own closed set is named
        expect(refusal.line).toBe(5);
        expect(refusal.message).toContain('unknown key "stdouts:" in a run');
        expect(refusal.message).toContain(RUN_KEYS.join(', '));
    });

    test('a missing description is refused, and so is a missing exit', () => {
        // Given - each mandatory key removed in turn
        // Then - the refusal names what the grammar demands
        expect(refusalOf('runs:\n  - command: a\n    exit: 0\n').message).toContain(
            'missing "description:"',
        );
        expect(refusalOf('description: x\nruns:\n  - command: a\n').message).toContain(
            'missing "exit:"',
        );
    });

    test('exit must be a literal integer', () => {
        // Given - a quoted exit code
        const refusal = refusalOf(`description: x\nruns:\n  - command: a\n    exit: "0"\n`);

        // Then - the grammar refuses the string form rather than coercing it
        expect(refusal.message).toContain('exit: must be a literal integer');
    });

    test('waitFor is refused on any run but the last', () => {
        // Given - a long-running first run followed by a second
        const refusal = refusalOf(
            `description: x\nruns:\n  - command: serve\n    exit: 0\n    waitFor: listening\n  - command: b\n    exit: 0\n`,
        );

        // Then - the run after it would never start
        expect(refusal.message).toContain('waitFor: is only allowed on the LAST run');
    });

    test('an unknown kind names the facets that exist', () => {
        // Given - a document claiming a facet nobody implemented
        const refusal = refusalOf(
            `kind: http\ndescription: x\nruns:\n  - command: a\n    exit: 0\n`,
        );

        // Then - the refusal lists the known kinds
        expect(refusal.message).toContain('kind: "http" is not a facet');
    });

    test('malformed YAML is refused with the parser’s own line', () => {
        // Given - a document that is not YAML at all
        const refusal = refusalOf('description: x\n  runs: [\n');

        // Then - the refusal carries a line, not a stack
        expect(refusal.line).toBeGreaterThan(0);
        expect(refusal.name).toBe('SpecSyntaxError');
    });
});

describe('spec document — update', () => {
    test('rewrites exit and streams, keeping comments, key order and everything else', () => {
        // Given - a document with a comment, a files: block and a stale golden
        const source = [
            '# the comment a rewrite must keep',
            'description: keeps its shape',
            'runs:',
            '  - command: build',
            '    exit: 9',
            '    stdout: |',
            '      stale',
            '    files:',
            '      out.txt: { contains: hi }',
            '',
        ].join('\n');
        const file = readSpecFile(source, 'case.spec.yaml');

        // Given - one update carrying the truth
        const written = updateSpecFile(file, [
            { exitCode: 0, stderr: '', stdout: 'fresh\nlines\n' },
        ]);

        // Then - only exit and stdout moved; the comment, the command and the
        // Files: block came back untouched, in the order they were written
        expect(written).toBe(
            [
                '# the comment a rewrite must keep',
                'description: keeps its shape',
                'runs:',
                '  - command: build',
                '    exit: 0',
                '    stdout: |',
                '      fresh',
                '      lines',
                '    files:',
                '      out.txt: { contains: hi }',
                '',
            ].join('\n'),
        );
    });

    test('a stream without a trailing newline is written `|-`, an empty one is removed', () => {
        // Given - a document whose stderr is about to become empty
        const file = readSpecFile(
            `description: x\nruns:\n  - command: a\n    exit: 0\n    stderr: |\n      was here\n`,
            'case.spec.yaml',
        );

        // Given - an update with output that ends mid-line and no stderr at all
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout: 'no newline' }]);

        // Then - `|-` states the missing newline; the empty stream drops its key
        expect(written).toContain('stdout: |-\n      no newline');
        expect(written).not.toContain('stderr');
    });

    test('an inserted stream lands at its canonical position, not at the end', () => {
        // Given - a run with no streams and a files: block after the exit
        const file = readSpecFile(
            `description: x\nruns:\n  - command: a\n    exit: 0\n    files:\n      out.txt: exists\n`,
            'case.spec.yaml',
        );

        // Given - an update that has stdout to write
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout: 'hello\n' }]);

        // Then - stdout sits between exit and files, where the canonical order puts it
        expect(written.indexOf('stdout')).toBeGreaterThan(written.indexOf('exit'));
        expect(written.indexOf('stdout')).toBeLessThan(written.indexOf('files'));
    });
});

describe('spec document — the published schema', () => {
    test('describes exactly the keys the parser reads', () => {
        // Given - the schema shipped for editors
        // Then - its closed sets are the parser's own, so the two cannot drift
        expect(Object.keys(SPEC_SCHEMA.properties).sort()).toEqual([...DOCUMENT_KEYS].sort());
        expect(Object.keys(SPEC_SCHEMA.$defs.run.properties).sort()).toEqual([...RUN_KEYS].sort());
        expect(SPEC_SCHEMA.additionalProperties).toBe(false);
        expect(SPEC_SCHEMA.$defs.run.additionalProperties).toBe(false);
    });
});
