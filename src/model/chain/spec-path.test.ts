import { describe, expect, test } from 'vitest';

import { isRelativePath, requireRelativePath } from './spec-path.js';

describe('spec paths — a file is named relative to the spec', () => {
    test.each(['./expected/out.txt', '../../fixtures/shop/', './seeds/users.sql'])(
        'accepts %s',
        (path) => {
            // Given - a path that starts where a relative path starts
            // Then - it is one
            expect(isRelativePath(path)).toBeTruthy();
            expect(() => {
                requireRelativePath('toMatchFile', path);
            }).not.toThrow();
        },
    );

    test.each(['out.txt', 'expected/out.txt', '$FIXTURES/shop/', '/abs/out.txt', ''])(
        'refuses %j with the verb that received it',
        (path) => {
            // Given - a bare name, a marker or an absolute path
            // Then - the refusal names the verb and the form to write
            expect(() => {
                requireRelativePath('seedFile', path);
            }).toThrow(
                /^seedFile\(.*\): a file is named by a path relative to the spec file — start it with \.\/ or \.\.\//u,
            );
        },
    );

    test('refuses a value that is not a string at all', () => {
        // Given - a regular expression, the instinct vitest's toMatch teaches
        // Then - the same refusal, not a coercion to "/re/"
        expect(() => {
            requireRelativePath('toMatchFile', /re/u);
        }).toThrow(/relative to the spec file/u);
    });
});
