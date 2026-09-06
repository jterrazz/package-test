import { describe, expect, test } from 'vitest';

import { fixSpecDocument } from './checker-spec.js';

/**
 * The two REWRITABLE document passes, read from the fixer's side: what
 * `node dist/checker.js <root> --fix` does to a file, and what it refuses to
 * touch. The passes themselves are proven end to end in `specs/lint/checker/`,
 * against the real binary.
 */

describe('fixSpecDocument — key order and block scalars', () => {
    test('moves the keys back into the canonical order, each with its comment', () => {
        // Given - a document whose runs sit above its description, and whose
        // Exit follows its stdout
        const source = [
            '# the comment above runs',
            'runs:',
            '    - stdout: |',
            '          Built.',
            '      command: widget build',
            '      exit: 0',
            'description: builds the widget',
            '',
        ].join('\n');

        // Then - the ground comes first, the run reads given-then-received, and
        // The comment travels with the key it was written above
        expect(fixSpecDocument(source, 'case.spec.yaml')).toBe(
            [
                'description: builds the widget',
                '# the comment above runs',
                'runs:',
                '    - command: widget build',
                '      exit: 0',
                '      stdout: |',
                '          Built.',
                '',
            ].join('\n'),
        );
    });

    test('re-styles a quoted stream as a block scalar, keeping its bytes', () => {
        // Given - a golden written as a one-line quoted string
        const source =
            'description: builds the widget\nruns:\n    - command: b\n      exit: 0\n      stdout: "Built.\\nDone.\\n"\n';

        // Then - the same text, now readable, with `|` stating the final newline
        expect(fixSpecDocument(source, 'case.spec.yaml')).toContain(
            'stdout: |\n          Built.\n          Done.\n',
        );
    });

    test('a document already holding both conventions is left untouched', () => {
        // Given - a canonical document
        const source =
            'description: builds the widget\nruns:\n    - command: b\n      exit: 0\n      stdout: |\n          Built.\n';

        // Then - `null` says nothing moved, so the file keeps its mtime
        expect(fixSpecDocument(source, 'case.spec.yaml')).toBeNull();
    });

    test('a document the repository formatter already styled is left untouched', () => {
        // Given - canonical keys and block scalars, with the flow collections
        // Spelled as oxfmt spells them: a padded mapping, an unpadded sequence,
        // And a long one broken over lines
        const source = [
            '# the ground of the case',
            'description: scaffolds the module',
            'runs:',
            '    - command: scaffold',
            '      exit: 0',
            '      stdout: |',
            '          Scaffolded',
            '      files:',
            "          out/main.go: { contains: 'package main' }",
            "          out/docs/README.md: { contains: ['# Docs', 'second needle'] }",
            '          out/long.txt:',
            '              {',
            "                  contains: ['a needle long enough that the formatter broke it over lines'],",
            '              }',
            '',
        ].join('\n');

        // Then - `null`: the fixer has nothing to say, so the formatter has
        // Nothing to undo and `lint:fix` converges on the first pass
        expect(fixSpecDocument(source, 'case.spec.yaml')).toBeNull();
    });

    test('a document the grammar refuses is never rewritten', () => {
        // Given - a file that is not a spec document at all
        // Then - the fixer declines; d4b-spec-shape is what reports it
        expect(fixSpecDocument('- just\n- a list\n', 'case.spec.yaml')).toBeNull();
    });
});
