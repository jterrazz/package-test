import { describe, expect, test } from 'vitest';

import { commentName } from './checker-sql-seeds.js';

describe('the seed branch of C28 — a seed file is named by its first comment', () => {
    test('the first -- comment names the file, whatever line it stands on', () => {
        // Given - statements opening on a comment, and statements with two further down
        // Then - the first comment, kebab-cased
        expect(commentName('-- Two users, one admin\nINSERT INTO users VALUES (1);')).toBe(
            'two-users-one-admin',
        );
        expect(commentName('INSERT INTO users VALUES (1);\n  -- the second\n-- the third')).toBe(
            'the-second',
        );
    });

    test('statements with no comment, or a comment of no word, name nothing', () => {
        // Given - statements with no comment, and a comment of dashes alone
        // Then - the caller falls back to the test's title
        expect(commentName("INSERT INTO users (name) VALUES ('Ada');")).toBeUndefined();
        expect(commentName('-- ---\nINSERT INTO users VALUES (1);')).toBeUndefined();
    });
});
