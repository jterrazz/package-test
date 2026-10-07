import { ruleTester } from '@jterrazz/test';

import { whenBetweenGivenAndThen } from '../when-between-given-and-then.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

const lines = (...text: string[]): string => text.join('\n');

ruleTester().run('when-between-given-and-then', whenBetweenGivenAndThen, {
    invalid: [
        {
            name: 'A When written before the Given narrates nothing the setup has done yet.',
            code: lines(
                "test('a', async () => {",
                '    // When - the list is read',
                '    // Given - two events',
                "    await api.get('/events');",
                '    // Then - both',
                '});',
            ),
            errors: [{ column: 0, line: 1, messageId: 'beforeGiven' }],
            filename: SPEC,
        },
        {
            name: 'A When written after the Then narrates an action already asserted.',
            code: lines(
                "it('a', async () => {",
                '    // Given - two events',
                '    // Then - both',
                '    // When - the list is read',
                "    await api.get('/events');",
                '});',
            ),
            errors: [{ column: 0, line: 1, messageId: 'afterThen' }],
            filename: SPEC,
        },
        {
            name: 'With no Given, a When after the Then is still late.',
            code: lines("test('a', () => {", '    // Then - both', '    // When - read', '});'),
            errors: [{ column: 0, line: 1, messageId: 'afterThen' }],
            filename: SPEC,
        },
    ],
    valid: [
        lines(
            "test('a', async () => {",
            '    // Given - two events',
            '    // When - the list is read',
            "    await api.get('/events');",
            '    // Then - both',
            '});',
        ),
        lines("test('a', () => {", '    // Given - two events', '    // Then - both', '});'),
        lines("test('a', () => {", '    // When - the only marker', '});'),
        lines("test('a', () => {", '    // Given - a', '    // When - b', '});'),
        lines("test('a', () => {", '    // When - first', '    // Then - last', '});'),
        lines("run('a', () => {", '    // Then - x', '    // When - y', '});'),
        lines("test('a');", "test('b', 'no callback');"),
    ]
        .map((code) => ({ code, filename: SPEC }))
        .concat([
            {
                code: lines("test('a', () => {", '    // Then - x', '    // When - y', '});'),
                filename: '/repo/src/events.ts',
            },
        ]),
});
