import { describe, expect, test } from 'vitest';

import { readJsonPath, withCaptures } from './captures.js';

describe('readJsonPath', () => {
    test('reads a key, an index and a quoted key, below the root', () => {
        // Given - a body holding a list of objects
        const body = { items: [{ 'the name': 'book', id: 7 }] };

        // Then - each segment descends one level, and the root is the body
        expect(readJsonPath(body, ['items', 0, 'id'])).toBe(7);
        expect(readJsonPath(body, ['items', 0, 'the name'])).toBe('book');
        expect(readJsonPath(body, [])).toStrictEqual(body);
    });

    test('finds nothing past what the body holds', () => {
        // Given - a body whose shape the paths below do not follow
        const body = { items: [{ id: 7 }], total: 1 };

        // Then - a missing key, an index past the list and a scalar descended into all read undefined
        expect(readJsonPath(body, ['missing'])).toBeUndefined();
        expect(readJsonPath(body, ['items', 3])).toBeUndefined();
        expect(readJsonPath(body, ['total', 'value'])).toBeUndefined();
        expect(readJsonPath(body, ['items', 'id'])).toBeUndefined();
        expect(readJsonPath(null, [0])).toBeUndefined();
    });
});

describe('withCaptures', () => {
    test('a whole reference sends the value itself, a reference in text sends its text', () => {
        // Given - a captured number and a captured string
        const captured = new Map<string, unknown>([
            ['orderId', 42],
            ['token', 'abc'],
        ]);

        // Then - the number stays a number where it stands alone, and is spliced as text inside a string
        expect(
            withCaptures(
                { auth: 'Bearer {{token}}', id: '{{orderId}}', path: '/orders/{{orderId}}' },
                captured,
            ),
        ).toStrictEqual({ auth: 'Bearer abc', id: 42, path: '/orders/42' });
        expect(withCaptures(['{{token}}', 3, null], captured)).toStrictEqual(['abc', 3, null]);
    });

    test('a name nothing captured is left as written, and an object value is spliced as JSON', () => {
        // Given - one captured object and a reference to nothing
        const captured = new Map<string, unknown>([['order', { id: 1 }]]);

        // Then - the unknown reference is kept, and the object reads as JSON inside text
        expect(withCaptures('{{other}} and {{order}}', captured)).toBe('{{other}} and {"id":1}');
    });
});
