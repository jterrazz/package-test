import { describe, expect, test } from 'vitest';

import { CaptureScope } from './match.js';
import { structuralEquals, textEquals } from './structural.js';
import { mergePreservingPlaceholders, mergeTextPreservingPlaceholders } from './update-merge.js';

const UUID_A = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';

const UUID_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

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
});
