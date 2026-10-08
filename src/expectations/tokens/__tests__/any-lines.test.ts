import { describe, expect, test } from 'vitest';

import { isFramedInLine, piecesMatch } from '../any-lines.js';

const framedAt = (expected: string): boolean => {
    const start = expected.indexOf('{{any}}');
    return isFramedInLine(expected, start, start + '{{any}}'.length);
};

describe('any-lines', () => {
    test('isFramedInLine — a token text holds on both sides on its line — is framed, and blanks or a line break are no text', () => {
        // Given - tokens framed, opening their line, closing it, alone on it, and padded with blanks on either side
        // Then - only text on both sides frames a token
        expect(
            [
                'A {{any}} Z',
                '{{any}} Z',
                'A {{any}}',
                'A\n{{any}}\nZ',
                'A\n  {{any}}Z',
                'A{{any}}  \nB',
                'a{{any}}\nb',
                'x\nA {{any}} Z\ny',
            ].map((expected) => framedAt(expected)),
        ).toStrictEqual([true, false, false, false, false, false, false, true]);
    });

    test('piecesMatch — a text read piece by piece — holds each piece in order, the first at its start and the last at its end, none reused nor overlapping', () => {
        // Given - pieces around unframed tokens, read against texts that hold them, start elsewhere, reuse one, or overlap the last
        const reused = ['a', '\n', 'xy\n', 'xy\n', 'b'];
        const overlapping = ['a\n', '\na'];

        // Then - each verdict
        expect([
            piecesMatch(['ab', '\nz'], 'ab\nz'),
            piecesMatch(['ab', '\nz'], 'xab\nz'),
            piecesMatch(reused, 'a\nxy\nxy\nb'),
            piecesMatch(reused, 'a\nxy\nb'),
            piecesMatch(overlapping, 'a\n\na'),
            piecesMatch(overlapping, 'a\na'),
            piecesMatch(['only'], 'only'),
            piecesMatch(['only'], 'only more'),
        ]).toStrictEqual([true, false, true, false, true, false, true, false]);
    });
});
