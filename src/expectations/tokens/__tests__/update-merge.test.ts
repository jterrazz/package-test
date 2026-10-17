import { describe, expect, test } from 'vitest';

import { CaptureScope } from '../capture-scope.js';
import { structuralEquals, textEquals } from '../structural.js';
import { mergePreservingPlaceholders, mergeTextPreservingPlaceholders } from '../update-merge.js';

const UUID_A = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';

const UUID_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const WORKDIR = '/tmp/spec-run-abcdef';

describe('update-merge', () => {
    test('structural — update-mode merges — mergeTextPreservingPlaceholders follows the actual line count (pinned)', () => {
        // Given - a previous snapshot with placeholders and a different shape
        const scope = new CaptureScope();
        const previous = 'id {{uuid}}\nstale\nextra {{number}}';

        // Then - fewer actual lines: trailing previous lines are dropped
        expect(mergeTextPreservingPlaceholders(previous, `id ${UUID_A}\nfresh`, scope)).toBe(
            'id {{uuid}}\nfresh',
        );

        // Then - more actual lines: new lines are taken verbatim from actual
        expect(
            mergeTextPreservingPlaceholders(previous, `id ${UUID_A}\nfresh\ncount 3\ntail`, scope),
        ).toBe('id {{uuid}}\nfresh\ncount 3\ntail');
    });

    test('structural — update-mode merges — a mid-file insertion re-pairs previous placeholders by pattern, not by index', () => {
        // Given - a golden whose tokens sit on lines 1 and 3, and an actual run that inserted a new line above them (every token line shifted by one)
        const scope = new CaptureScope();
        const previous = 'id {{uuid}}\nstatic\ndone in {{duration}}';
        const actual = `header\nid ${UUID_A}\nstatic\ndone in 1.24s`;

        // Then - the shifted token lines are recognised where they landed
        expect(mergeTextPreservingPlaceholders(previous, actual, scope)).toBe(
            'header\nid {{uuid}}\nstatic\ndone in {{duration}}',
        );
    });

    test('structural — update-mode merges — a lone {{any}} line takes back every line it covered, the rest of the stream rewritten around it', () => {
        // Given - a golden whose {{any}} stands for a block, and a run that changed a line elsewhere and printed a block of three
        const scope = new CaptureScope();
        const previous = ' RUN  types\n\n{{any}}\n\n✗ failed\n\n RUN  lint\n\nold';
        const actual = ' RUN  types\n\nfirst\nsecond\nthird\n\n✗ failed\n\n RUN  lint\n\nnew';

        // Then - the token stays one line, and the changed line is the run's
        expect(mergeTextPreservingPlaceholders(previous, actual, scope)).toBe(
            ' RUN  types\n\n{{any}}\n\n✗ failed\n\n RUN  lint\n\nnew',
        );
    });

    test('structural — update-mode merges — a {{any}} block ends at the reworded line that follows it, by its opening words', () => {
        // Given - a golden whose line after the block was since reworded, and a run that printed more inside the block
        const scope = new CaptureScope();
        const previous =
            ' RUN  lint\n{{any}}\nfound: a diagnostic the old file does not hold\n✗ failed';
        const actual =
            ' RUN  lint\nfirst\nsecond\nfound: a diagnostic the new file does not hold\n✗ failed';

        // Then - the block stays one token, and the reworded line is the run's
        expect(mergeTextPreservingPlaceholders(previous, actual, scope)).toBe(
            ' RUN  lint\n{{any}}\nfound: a diagnostic the new file does not hold\n✗ failed',
        );
    });

    test('structural — update-mode merges — each previous placeholder line is spent once — twins do not collapse', () => {
        // Given - one token line in the golden and two lines it could cover
        const scope = new CaptureScope();

        // Then - the first actual line keeps the token; the second is literal
        expect(
            mergeTextPreservingPlaceholders('id {{uuid}}', `id ${UUID_A}\nid ${UUID_B}`, scope),
        ).toBe(`id {{uuid}}\nid ${UUID_B}`);
    });

    test('structural — update-mode merges — mergePreservingPlaceholders follows array growth and shrinkage', () => {
        // Given - a previous fixture array with a placeholder per slot
        const previous = ['{{uuid}}', '{{number}}'];

        // Then - growth: extra actual items are appended as concrete values
        expect(mergePreservingPlaceholders(previous, [UUID_A, 7, 'new'])).toStrictEqual([
            '{{uuid}}',
            '{{number}}',
            'new',
        ]);

        // Then - shrinkage: the merged array matches the actual length
        expect(mergePreservingPlaceholders(previous, [UUID_A])).toStrictEqual(['{{uuid}}']);
    });

    test('structural — update-mode merges — meta: a merged fixture passes the next comparison run', () => {
        // Given - fixtures freshly written by update mode
        const previousJson = { id: '{{uuid}}', name: 'STALE' };
        const actualJson = { id: UUID_B, name: 'Alice' };
        const mergedJson = mergePreservingPlaceholders(previousJson, actualJson);
        const mergedText = mergeTextPreservingPlaceholders(
            'id {{uuid}}\nstale',
            `id ${UUID_B}\nfresh`,
            new CaptureScope(),
        );

        // Then - the merged output matches the same actual on a normal run
        expect(structuralEquals(mergedJson, actualJson, new CaptureScope())).toBe(true);
        expect(textEquals(mergedText, `id ${UUID_B}\nfresh`, new CaptureScope())).toBe(true);
    });

    test('workdir substitution — mergePreservingPlaceholders substitutes the known cwd in JSON string leaves', () => {
        // Given - a fresh JSON fixture (no previous) whose values embed the cwd
        const actual = { cwd: WORKDIR, nested: { path: `${WORKDIR}/out.txt` }, other: 7 };

        // Then - the workdir is written back as its {{workdir}} token, not the run-specific temp path, for parity with the text path
        expect(mergePreservingPlaceholders(null, actual, WORKDIR)).toStrictEqual({
            cwd: '{{workdir}}',
            nested: { path: '{{workdir}}/out.txt' },
            other: 7,
        });
    });

    test('workdir substitution — mergePreservingPlaceholders preserves a still-matching {{workdir}} placeholder', () => {
        // Given - a previous fixture that already tokenised the cwd
        const previous = { cwd: '{{workdir}}', id: '{{uuid}}', name: 'STALE' };
        const actual = { cwd: WORKDIR, id: UUID_A, name: 'Alice' };

        // Then - {{workdir}} and {{uuid}} survive, the stale literal refreshes
        expect(mergePreservingPlaceholders(previous, actual, WORKDIR)).toStrictEqual({
            cwd: '{{workdir}}',
            id: '{{uuid}}',
            name: 'Alice',
        });
    });

    test('workdir substitution — no workdir given: string leaves are left untouched (no-op parity)', () => {
        // Given - the same shape but no framework-known cwd (api/job mode)
        const actual = { cwd: WORKDIR };

        // Then - nothing is substituted
        expect(mergePreservingPlaceholders(null, actual)).toStrictEqual({ cwd: WORKDIR });
    });

    test('workdir substitution — meta: a workdir-substituted JSON fixture passes the next run (with {{workdir}} inside)', () => {
        // Given - a golden freshly written by update mode from cwd-bearing output
        const actual = { cwd: WORKDIR, log: `wrote ${WORKDIR}/out.txt`, name: 'Alice' };
        const merged = mergePreservingPlaceholders(null, actual, WORKDIR);

        // Then - the token is stored, and the merged golden matches the same actual on a normal (workdir-aware) comparison run
        expect(merged).toStrictEqual({
            cwd: '{{workdir}}',
            log: 'wrote {{workdir}}/out.txt',
            name: 'Alice',
        });
        expect(structuralEquals(merged, actual, new CaptureScope(WORKDIR))).toBe(true);
    });

    test('workdir substitution — parity: text and JSON paths emit the same {{workdir}} token from the same cwd', () => {
        // Given - the same cwd surfacing in a text stream and a JSON value
        const mergedText = mergeTextPreservingPlaceholders(
            null,
            `cwd ${WORKDIR}`,
            new CaptureScope(WORKDIR),
        );
        const mergedJson = mergePreservingPlaceholders(null, { cwd: WORKDIR }, WORKDIR);

        // Then - both channels tokenise it identically (no literal temp path leaks)
        expect(mergedText).toBe('cwd {{workdir}}');
        expect(mergedJson).toStrictEqual({ cwd: '{{workdir}}' });
    });

    test('structural — update-mode merges — a token line is spent on the first line it covers, shifted or not, and an aligned one is not taken by another', () => {
        // Given - goldens whose token lines cover shifted lines, and aligned lines another token line could also cover
        const scope = new CaptureScope();
        const merge = (previous: string, actual: string): string =>
            mergeTextPreservingPlaceholders(previous, actual, scope);

        // Then - each token where it first matches, once
        expect([
            merge('id {{uuid}}\nzzz', `q\nid ${UUID_A}\nid ${UUID_B}`),
            merge('v {{number}}\nzz\nv {{int}}', 'v 1\nmid\nend'),
        ]).toStrictEqual([`q\nid {{uuid}}\nid ${UUID_B}`, 'v {{number}}\nmid\nend']);
    });

    test('structural — update-mode merges — a {{any}} block is found between anchors past blank lines, by an exact or a long reworded anchor, and kept only when both are found in order', () => {
        // Given - blocks at each edge of a golden, anchors short and long, found and not
        const scope = new CaptureScope();
        const merge = (previous: string, actual: string): string =>
            mergeTextPreservingPlaceholders(previous, actual, scope);
        const long = 'a line opening on more than twenty characters';

        // Then - each block that sits between anchors found in order collapses to its token; elsewhere the token holds the one line it stands on
        expect([
            merge('start\n\n{{any}}\n\nend', 'start\n\na\nb\n\nend'),
            merge('{{any}}\nend', 'x\nendless\nend'),
            merge('head\n{{any}}', 'head\na\nb'),
            merge('twenty characters!!!\n{{any}}\nzz', 'twenty characters!!! more\na\nb\nzz'),
            merge(`a\n{{any}}\n${long}\n{{any}}\nz`, `a\nb1\nb2\n${long} reworded\nc1\nc2\nz`),
            merge('gone\n{{any}}\ntail', 'x\ny\nz\ntail'),
            merge('head\n{{any}}\nlost', 'head\nx\ny'),
            merge('b\n{{any}}\na', 'a\nx\nb'),
            merge(`a\n{{any}}\n${long}`, `a\n${long} reworded`),
            merge('start\n\n{{any}}\nend', '\nstart\n\na\nb\nend'),
            merge('x\n{{int}}\n{{any}}\nend', 'x\n5\na\nb\nend'),
            merge(`{{any}}\n${long}`, `a\n${long} reworded\nb\n${long}`),
            merge('start\n  \n{{any}}\nend', '  \nstart\n  \na\nb\nend'),
            merge(`x\n{{any}}\n${long}`, `${long} reworded\nx\na\nb\n${long} reworded`),
        ]).toStrictEqual([
            'start\n\n{{any}}\n\nend',
            '{{any}}\nend',
            'head\n{{any}}',
            'twenty characters!!! more\n{{any}}\nb\nzz',
            'a\n{{any}}\n{{any}}\n{{any}}\nz',
            'x\n{{any}}\nz\ntail',
            'head\n{{any}}\ny',
            'a\n{{any}}\nb',
            'a\n{{any}}',
            '\nstart\n{{any}}\n{{any}}\nend',
            'x\n{{int}}\n{{any}}\nend',
            `{{any}}\n${long}`,
            '  \nstart\n{{any}}\n{{any}}\nend',
            `${long} reworded\n{{any}}\n{{any}}\n${long} reworded`,
        ]);
    });

    test('workdir substitution — a token line holding {{workdir}} covers the line as the run printed it, and a text with no workdir keeps the word undefined', () => {
        // Given - a scope that knows its workdir, and one that does not
        const scope = new CaptureScope(WORKDIR);

        // Then - the token line kept, and the word left alone
        expect([
            mergeTextPreservingPlaceholders(
                'at {{workdir}}/x took {{int}}ms',
                `at ${WORKDIR}/x took 5ms`,
                scope,
            ),
            mergeTextPreservingPlaceholders('was {{int}}', 'is undefined', new CaptureScope()),
            mergePreservingPlaceholders('{{int}}', { note: 'is undefined' }),
        ]).toStrictEqual([
            'at {{workdir}}/x took {{int}}ms',
            'is undefined',
            { note: 'is undefined' },
        ]);
    });

    test('workdir substitution — mergePreservingPlaceholders substitutes the workdir in nested lists, and takes the run’s value where the shapes differ', () => {
        // Given - values nested in lists, and previous values of another shape than the run's
        // Then - each merged
        expect([
            mergePreservingPlaceholders(
                undefined,
                { list: [`${WORKDIR}/a`, [`${WORKDIR}/b`], 1] },
                WORKDIR,
            ),
            mergePreservingPlaceholders(['{{int}}'], 'text'),
            mergePreservingPlaceholders('text', ['{{int}}']),
            mergePreservingPlaceholders({ a: '{{int}}' }, [1]),
        ]).toStrictEqual([
            { list: ['{{workdir}}/a', ['{{workdir}}/b'], 1] },
            'text',
            ['{{int}}'],
            [1],
        ]);
    });
});
