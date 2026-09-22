import { describe, expect, test } from 'vitest';

import {
    directory,
    file,
    isDiskDirectory,
    isDiskFile,
    isRelativePath,
    requireDiskFile,
    requireDiskTarget,
} from './spec-path.js';

describe('the disk — file() and directory()', () => {
    test.each(['./expected/out.txt', '../../fixtures/shop/config.json', './seeds/users.sql'])(
        'file() names %s, branded as a file',
        (path) => {
            // Given - a path that starts where a relative path starts
            const named = file(path as `./${string}`);

            // Then - the value is a file, carries its path, and is not a directory
            expect(isRelativePath(path)).toBeTruthy();
            expect(named.path).toBe(path);
            expect(isDiskFile(named)).toBeTruthy();
            expect(isDiskDirectory(named)).toBeFalsy();
        },
    );

    test('directory() names a path ending in /, branded as a directory', () => {
        // Given - the shared pool, climbed to from a leaf
        const named = directory('../../fixtures/shop/');

        // Then - a directory, not a file
        expect(isDiskDirectory(named)).toBeTruthy();
        expect(isDiskFile(named)).toBeFalsy();
    });

    test.each(['out.txt', 'expected/out.txt', '$FIXTURES/shop/', '/abs/out.txt', ''])(
        'refuses %j: a path is relative to the spec file',
        (path) => {
            // Given - a bare name, a marker or an absolute path
            // Then - the refusal names the call and the form to write
            expect(() => file(path as never)).toThrow(
                /^file\(.*\): a path is relative to the spec file — start it with \.\/ or \.\.\//u,
            );
        },
    );

    test('file() refuses a trailing slash, and directory() requires one', () => {
        // Given - each wrapper handed the other's path
        // Then - each names the one to use
        expect(() => file('./fixtures/shop/' as never)).toThrow(/name it with directory\(\)/u);
        expect(() => directory('./fixtures/shop' as never)).toThrow(
            /a directory's path ends in \//u,
        );
    });

    test('a forged object is not the disk: the brand is what a verb reads', () => {
        // Given - the shape without the brand
        const forged = { path: './seeds/rows.sql' };

        // Then - neither kind, and a verb refuses it as a value
        expect(isDiskFile(forged)).toBeFalsy();
        expect(() => requireDiskFile('seed', forged, '.sql')).toThrow(/a string is a value/u);
        expect(() => requireDiskTarget('fixture', './fixtures/')).toThrow(
            /^fixture\("\.\/fixtures\/"\): a string is a value/u,
        );
    });
});
