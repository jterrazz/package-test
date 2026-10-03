import { describe, expect, test } from 'vitest';

import { CaptureScope } from './capture-scope.js';
import { structuralEquals, textEquals } from './structural.js';
import { mergePreservingPlaceholders, mergeTextPreservingPlaceholders } from './update-merge.js';

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

        // Then - the workdir is written back as its {{workdir}} token, not the run-specific temp path — parity with the text path
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
});
