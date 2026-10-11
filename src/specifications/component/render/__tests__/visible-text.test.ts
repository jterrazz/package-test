import { describe, expect, test } from 'vitest';

import { visibleTextOf } from '../visible-text.js';

type Fake = { name: string; opacity: number; style: { visibility: string } };

function fakePage(elements: Fake[]): Parameters<typeof visibleTextOf<Fake>>[0] {
    return {
        elements,
        opacityOf: ({ opacity }) => opacity,
        text: () =>
            elements
                .filter(({ style }) => style.visibility !== 'hidden')
                .map(({ name }) => name)
                .join(' '),
    };
}

describe('visible-text', () => {
    test('visibleTextOf — leaves out the text of an element drawn at opacity 0, and puts every style back as it found it', () => {
        // Given - three elements, the second transparent and the third inline-hidden already, which it is again once read
        const elements: Fake[] = [
            { name: 'typed', opacity: 1, style: { visibility: '' } },
            { name: 'ghost', opacity: 0, style: { visibility: 'visible' } },
            { name: 'kept', opacity: 0.5, style: { visibility: '' } },
        ];

        // When - the visible text is read
        const text = visibleTextOf(fakePage(elements));

        // Then - the ghost is out, a half-transparent one stays, and no style is left changed
        expect([text, elements.map(({ style }) => style.visibility)]).toStrictEqual([
            'typed kept',
            ['', 'visible', ''],
        ]);
    });
});
