import { describe, expect, test } from 'vitest';

import { parseSpecDocument, readSpecFile } from '../spec-document.js';
import { updateSpecFile } from '../spec-update.js';

const TWO_SPACE_DOCUMENT = [
    'description: reads back as it was written',
    'runs:',
    '  - command: check',
    '    exit: 0',
    '',
].join('\n');

const FOUR_SPACE_DOCUMENT = [
    'description: reads back as it was written',
    'runs:',
    '    - command: check',
    '      exit: 0',
    '',
].join('\n');

function streamOf(written: string, key: 'stderr' | 'stdout'): string {
    return parseSpecDocument(written, 'case.spec.yaml').runs[0]?.[key]?.text ?? '';
}

describe('updateSpecFile', () => {
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

        // Then - only exit and stdout moved; the comment, the command and the files: block came back untouched, in the order they were written
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

    test('each run takes its own update in canonical key order; a key it already has stays where it was written', () => {
        // Given - runs written out of order, one without a stream, and fewer runs than updates
        const file = readSpecFile(
            [
                'description: d',
                'runs:',
                '  - stdout: |',
                '      old',
                '    command: a',
                '    exit: 3',
                '  - command: b',
                '    exit: 0',
                '    files:',
                '      x.txt: absent',
                '  - command: c',
                '    exit: 0',
                '    stdout: keep',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // When - one update per run, and one past the last
        const written = updateSpecFile(file, [
            { exitCode: 1, stderr: '', stdout: 'new\n' },
            { exitCode: 0, stderr: 'warn\n', stdout: 'out\n' },
            { exitCode: 0, stderr: 'e\n', stdout: '' },
            { exitCode: 2, stderr: '', stdout: 'past\n' },
        ]);

        // Then - existing keys moved nowhere, new ones landed before files: in RUN_KEYS order, and an emptied stream left
        expect(written).toBe(
            [
                'description: d',
                'runs:',
                '  - stdout: |',
                '      new',
                '    command: a',
                '    exit: 1',
                '  - command: b',
                '    exit: 0',
                '    stdout: |',
                '      out',
                '    stderr: |',
                '      warn',
                '    files:',
                '      x.txt: absent',
                '  - command: c',
                '    exit: 0',
                '    stderr: |',
                '      e',
                '',
            ].join('\n'),
        );
    });

    test('at the document’s own indentation, a stdout opening on a space reads back byte for byte in a four-space document', () => {
        // Given - a document formatted at four spaces, the step oxfmt writes YAML at
        const file = readSpecFile(FOUR_SPACE_DOCUMENT, 'case.spec.yaml');

        // Given - a run whose stdout opens on a space
        const stdout = ' TYPESCRIPT  src/index.ts\n2 files\n';
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout }]);

        // Then - the indicator names the four spaces the content sits at, and the golden reads back as the bytes the command printed
        expect(written).toContain('stdout: |4\n');
        expect(streamOf(written, 'stdout')).toBe(stdout);
    });

    test('at the document’s own indentation, the same stdout reads back byte for byte in a two-space document', () => {
        // Given - a two-space document, YAML's own default step
        const file = readSpecFile(TWO_SPACE_DOCUMENT, 'case.spec.yaml');

        // Given - the same leading space
        const stdout = ' TYPESCRIPT  src/index.ts\n2 files\n';
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout }]);

        // Then - two is what the indicator names there
        expect(written).toContain('stdout: |2\n');
        expect(streamOf(written, 'stdout')).toBe(stdout);
    });

    test('at the document’s own indentation, a stdout opening on several spaces keeps every one of them', () => {
        // Given - a four-space document and a stream indented on its own
        const file = readSpecFile(FOUR_SPACE_DOCUMENT, 'case.spec.yaml');

        // Given - four spaces of the command's own making
        const stdout = '    indented by the command\nback\n';
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout }]);

        // Then - the indicator names the document's step; the command's spaces are content
        expect(written).toContain('stdout: |4\n');
        expect(streamOf(written, 'stdout')).toBe(stdout);
    });

    test('at the document’s own indentation, a stdout opening on a tab survives without an indicator', () => {
        // Given - a four-space document and a tab-started stream, which YAML never reads as indentation
        const file = readSpecFile(FOUR_SPACE_DOCUMENT, 'case.spec.yaml');
        const stdout = '\tTABBED\nback\n';
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout }]);

        // Then - no indicator is stated, and the tab comes back
        expect(written).toContain('stdout: |\n');
        expect(streamOf(written, 'stdout')).toBe(stdout);
    });

    test('at the document’s own indentation, stderr states its indentation as stdout does', () => {
        // Given - a four-space document and a warning that opens on a space
        const file = readSpecFile(FOUR_SPACE_DOCUMENT, 'case.spec.yaml');
        const stderr = ' WARN  deprecated flag\n';
        const written = updateSpecFile(file, [{ exitCode: 0, stderr, stdout: 'done\n' }]);

        // Then - the same digit, and the same byte-exact round trip
        expect(written).toContain('stderr: |4\n');
        expect(streamOf(written, 'stderr')).toBe(stderr);
    });

    test('at the document’s own indentation, the stdin and files: blocks an author wrote survive the rewrite unchanged', () => {
        // Given - a four-space document whose stdin and files.equals both open on A space, each stating the four spaces it is written at
        const source = [
            'description: keeps what it did not write',
            'runs:',
            '    - command: format',
            '      stdin: |4',
            '           piped in',
            '      exit: 0',
            '      files:',
            '          out.txt:',
            '              equals: |4',
            '                   written out',
            '',
        ].join('\n');
        const file = readSpecFile(source, 'case.spec.yaml');

        // Given - an update that touches the streams only
        const written = updateSpecFile(file, [{ exitCode: 0, stderr: '', stdout: 'done\n' }]);

        // Then - the two blocks the writer never wrote still read as their own bytes
        const run = parseSpecDocument(written, 'case.spec.yaml').runs[0];
        expect(run?.stdin).toBe(' piped in\n');
        const assertion = run?.files[0];
        expect(assertion?.kind === 'content' ? assertion.equals?.text : null).toBe(
            ' written out\n',
        );
    });
});
