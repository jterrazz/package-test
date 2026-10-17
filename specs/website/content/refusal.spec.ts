import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('refusal', () => {
    test('names the stream the way the test reaches it: content', async () => {
        // Given - a visited page, its rendered text read as a stream
        const result = await website.visit('/');

        // Then - a table's matcher handed the content is refused by the type, and by the run naming the form to write
        // @ts-expect-error -- toBeEmpty is a table's matcher, and a stream is no table
        await expect(expect(result.content).toBeEmpty()).rejects.toThrow(
            /on the stream "content": an empty stream is an empty text\n.*\nfix: compare its text: expect\(<result>\.content\.text\)\.toBe\(''\)/u,
        );
    });
});
