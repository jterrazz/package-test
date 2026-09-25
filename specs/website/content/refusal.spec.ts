import type { TableAccessor } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('refusal', () => {
    test('names the stream the way the test reaches it: content', async () => {
        // Given - a visited page, its rendered text read as a stream
        const result = await website.visit('/');

        // Then - a table's matcher handed the content, past the compiler, names the form to write
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- past the compiler, which refuses a stream handed to toBeEmpty
        const table = result.content as unknown as TableAccessor;
        await expect(expect(table).toBeEmpty()).rejects.toThrow(
            /on the stream "content" — an empty stream is an empty text\n.*\nfix: compare its text: expect\(<result>\.content\.text\)\.toBe\(''\)/u,
        );
    });
});
