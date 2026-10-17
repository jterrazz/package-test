import { describe, expect, test } from 'vitest';

import { within } from '../../../../visitor/targets/landmarks.js';
import { button, content, testId } from '../../../../visitor/targets/roles.js';
import type { Target } from '../../../../visitor/targets/target.js';
import { ambiguousScreenElementError } from '../ambiguous.js';
import type { MobileElementMatch } from '../device.port.js';

const match = (overrides: Partial<MobileElementMatch> = {}): MobileElementMatch => ({
    label: 'Bookmark',
    type: 'Button',
    ...overrides,
});

const OTHER_ELEMENT =
    '  • other element  a button() or field() may name one thing where this does not';

const SCOPE_BOOKMARK = `  • scope it       within(testId('…'), button("Bookmark")) — a screen has no landmarks; any target works as the scope`;

function fixesOf(target: Target, matches: MobileElementMatch[]): string[] {
    const { message } = ambiguousScreenElementError({ matches, target });
    const lines = message.split('\n');
    return lines.slice(lines.indexOf('fix: designate one of them:') + 1, -1);
}

describe('ambiguousScreenElementError', () => {
    // RUNTIME no-landmark-on-mobile — the vocabulary is ONE across the specifications, and the part with no iOS equivalent is refused rather than approximated: a screen has no ARIA landmarks, so the fix it offers is `within(testId(...), ...)`.
    test('names the target, the count and every candidate with what it carries, then the rule and where it is documented', () => {
        // Given - candidates with a label alone, a value, an identifier, and nothing but a type
        const { message } = ambiguousScreenElementError({
            matches: [
                match(),
                match({ label: 'Email', type: 'TextField', value: 'a@b.test' }),
                match({ identifier: 'event-1-bookmark' }),
                { type: 'Other' },
            ],
            target: button('Bookmark'),
        });

        // Then - the whole refusal, readable without opening the simulator
        expect(message).toBe(
            [
                'found: Ambiguous element: button("Bookmark") matched 4 elements on the screen —',
                '  1. Button "Bookmark"',
                '  2. TextField "Email"  value="a@b.test"',
                '  3. Button "Bookmark"  [testId: event-1-bookmark]',
                '  4. Other',
                'why: A verb acts on exactly ONE element: a target that matches several is refused, never settled by the first.',
                'fix: designate one of them:',
                SCOPE_BOOKMARK,
                OTHER_ELEMENT,
                'read: docs/reference/linting.md#target-matches-one-element',
            ].join('\n'),
        );
    });

    test('offers exact only to a target that opted out, and only when it would leave some of the candidates but not all', () => {
        // Given - a target that opted out over a mix, over whole matches only, over substring matches only, and an ordinary target over a mix
        const loose = button('Bookmark', { exact: false });
        const mixed = [match(), match({ label: 'Bookmark all' }), match()];

        // Then - the suggestion, with what it leaves, for the first alone
        expect([
            fixesOf(loose, mixed),
            fixesOf(loose, [match(), match()]),
            fixesOf(loose, [match({ label: 'Bookmarks' }), match({ label: 'Bookmark all' })]),
            fixesOf(button('Bookmark'), mixed),
        ]).toStrictEqual([
            [
                `  • scope it       within(testId('…'), button("Bookmark", { exact: false })) — a screen has no landmarks; any target works as the scope`,
                '  • exact name     button("Bookmark", { exact: true })   [leaves 2 of 3]',
                OTHER_ELEMENT,
            ],
            [
                `  • scope it       within(testId('…'), button("Bookmark", { exact: false })) — a screen has no landmarks; any target works as the scope`,
                OTHER_ELEMENT,
            ],
            [
                `  • scope it       within(testId('…'), button("Bookmark", { exact: false })) — a screen has no landmarks; any target works as the scope`,
                OTHER_ELEMENT,
            ],
            [SCOPE_BOOKMARK, OTHER_ELEMENT],
        ]);
    });

    test('offers distinct identifiers as a testId rewrite, except to a testId target or for a single identifier, and scoping only to an unscoped target', () => {
        // Given - candidates with two identifiers, with one shared, and a testId or scoped target over two
        const two = [
            match({ identifier: 'event-1-bookmark' }),
            match({ identifier: 'event-2-bookmark' }),
            match({ identifier: 'event-2-bookmark' }),
            match({ identifier: 'event-3-bookmark' }),
        ];

        const scoped = within(testId('event-list'), content('Bookmark'));

        // Then - the rewrite names the first and the others found
        expect([
            fixesOf(button('Bookmark'), two),
            fixesOf(button('Bookmark'), two.slice(1, 3)),
            fixesOf(testId('row'), two),
            fixesOf(scoped, [match(), match()]),
        ]).toStrictEqual([
            [
                SCOPE_BOOKMARK,
                '  • test id        testId("event-1-bookmark")   [also here: event-2-bookmark, event-3-bookmark]',
                OTHER_ELEMENT,
            ],
            [SCOPE_BOOKMARK, OTHER_ELEMENT],
            [
                `  • scope it       within(testId('…'), testId("row")) — a screen has no landmarks; any target works as the scope`,
                OTHER_ELEMENT,
            ],
            [OTHER_ELEMENT],
        ]);
    });
});
