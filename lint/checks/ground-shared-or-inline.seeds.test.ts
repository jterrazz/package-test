import { describe, expect, test } from 'vitest';

import { commentName, titleName } from './ground-shared-or-inline.seeds.js';

describe('ground-shared-or-inline.seeds', () => {
    test('ground-shared-or-inline.seeds — the seed branch of `ground-shared-or-inline` — a seed file is named by its first comment — the first -- comment names the file, whatever line it stands on', () => {
        // Given - statements opening on a comment, and statements with two further down
        // Then - the first comment, kebab-cased
        expect(commentName('-- Two users, one admin\nINSERT INTO users VALUES (1);')).toBe(
            'two-users-one-admin',
        );
        expect(commentName('INSERT INTO users VALUES (1);\n  -- the second\n-- the third')).toBe(
            'the-second',
        );
    });

    test('ground-shared-or-inline.seeds — the seed branch of `ground-shared-or-inline` — a seed file is named by its first comment — statements with no comment, or a comment of no word, name nothing', () => {
        // Given - statements with no comment, and a comment of dashes alone
        // Then - the caller falls back to the test's title
        expect(commentName("INSERT INTO users (name) VALUES ('Ada');")).toBeUndefined();
        expect(commentName('-- ---\nINSERT INTO users VALUES (1);')).toBeUndefined();
    });

    test.each([
        [
            'seeds apply in the order listed, each to the database it names',
            'seeds-apply-order-listed',
        ],
        ['lists the users', 'lists-users'],
        ['A user with an admin role', 'user-admin-role'],
        ['the', undefined],
    ])(
        'ground-shared-or-inline.seeds — the seed branch of `ground-shared-or-inline` — a seed with no comment is named by its test — the title %j names the seed %j',
        (title, name) => {
            // Given - a test's title
            // Then - its first four meaningful words, kebab-cased, or nothing when it has none
            expect(titleName(title)).toBe(name);
        },
    );
});
