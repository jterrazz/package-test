import { describe, expect, test } from 'vitest';

import { isSqlText, sql } from './sql.js';

describe('sql — a seed written in the test', () => {
    test('reads the statements as written, the indentation of the test dropped', () => {
        // Given - two statements written as a block
        const seed = sql`
            INSERT INTO users (name) VALUES ('Ada');
            INSERT INTO users (name) VALUES ('Grace');
        `;

        // Then - the text the database receives, branded as a seed
        expect(seed.text).toBe(
            "INSERT INTO users (name) VALUES ('Ada');\nINSERT INTO users (name) VALUES ('Grace');\n",
        );
        expect(isSqlText(seed)).toBe(true);
        expect(isSqlText({ text: 'INSERT' })).toBe(false);
    });

    test('refuses a hole: a value computed into SQL is written into the text', () => {
        // Given - a hole, past the compiler
        const name = 'Ada' as never;

        // Then - refused, naming the form to write
        expect(() => sql`INSERT INTO users (name) VALUES ('${name}');`).toThrow(
            'sql`…` takes no hole: a seed states its rows — write the value into the text.',
        );
    });
});
