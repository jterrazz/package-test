import { describe, expect, test } from 'vitest';

import {
    directory,
    file,
    isDiskDirectory,
    isDiskFile,
    requireDiskFile,
    requireDiskTarget,
} from './spec-path.js';

describe('spec-path', () => {
    test.each(['./expected/out.txt', '../../fixtures/shop/config.json', './seeds/users.sql'])(
        'the disk — file() and directory() — file() names %s, branded as a file',
        (path) => {
            // Given - a path that starts where a relative path starts
            const named = file(path as `./${string}`);

            // Then - the value is a file, carries its path, and is not a directory
            expect(named.path).toBe(path);
            expect(isDiskFile(named)).toBeTruthy();
            expect(isDiskDirectory(named)).toBeFalsy();
        },
    );

    test('the disk — file() and directory() — directory() names a path ending in /, branded as a directory', () => {
        // Given - the shared pool, climbed to from a leaf
        // checker-disable-next-line named-path-exists -- the wrapper's own brand and refusal are under test: nothing reads the disk
        const named = directory('../../fixtures/shop/');

        // Then - a directory, not a file
        expect(isDiskDirectory(named)).toBeTruthy();
        expect(isDiskFile(named)).toBeFalsy();
    });

    test.each(['out.txt', 'expected/out.txt', '$FIXTURES/shop/', '/abs/out.txt', ''])(
        'the disk — file() and directory() — refuses %j: a path is relative to the spec file',
        (path) => {
            // Given - a bare name, a marker or an absolute path
            // Then - the refusal names the call and the form to write
            expect(() => file(path as never)).toThrow(
                /^found: file\(.*\), a path that is not relative to the spec file\n.*\nfix: start it with \.\/ or \.\.\/, from the spec file: file\('\.\//u,
            );
        },
    );

    test('the disk — file() and directory() — file() refuses a trailing slash, and directory() requires one', () => {
        // Given - each wrapper handed the other's path
        // Then - each names the one to use
        // checker-disable-next-line named-path-exists -- the wrapper's own brand and refusal are under test: nothing reads the disk
        expect(() => file('./fixtures/shop/' as never)).toThrow(
            /fix: name the directory with directory\("\.\/fixtures\/shop\/"\)/u,
        );
        // checker-disable-next-line named-path-exists -- the wrapper's own brand and refusal are under test: nothing reads the disk
        expect(() => directory('./fixtures/shop' as never)).toThrow(
            /fix: end it in \/: directory\("\.\/fixtures\/shop\/"\)/u,
        );
    });

    test('the disk — file() and directory() — a forged object is not the disk: the brand is what a verb reads', () => {
        // Given - the shape without the brand
        const forged = { path: './seeds/rows.sql' };

        // Then - neither kind, and a verb refuses it as a value
        expect(isDiskFile(forged)).toBeFalsy();
        expect(() => requireDiskFile('seed', forged, '.sql')).toThrow(
            /a value where a file is read/u,
        );
        expect(() => requireDiskTarget('fixture', './fixtures/')).toThrow(
            /^found: fixture\("\.\/fixtures\/"\), a value where the disk is read/u,
        );
    });

    // RUNTIME one-verb-per-meaning — a plain string has no golden: vitest's own toMatch handed a file() is refused.
    test('the disk — a golden is no value — toMatch(file()) on a plain string is refused, with no runner to route it', () => {
        // Given - a string holding every letter of `[object Object]`, the pattern a path object would read as
        const text = 'the object of this test';

        // Then - refused, naming the subject that has a golden
        expect(() => {
            // checker-disable-next-line named-path-exists -- negative spec: the golden is refused before it is read, so it names nothing on disk
            expect(text).toMatch(file('./expected/text.txt') as never);
        }).toThrow(
            'found: toMatch(file("./expected/text.txt")) on a string, a value with no golden',
        );
    });

    test('the disk — a golden is no value — a file() matched by a string outside an assertion is refused the same way', () => {
        // Given - the path object handed where a pattern is read
        // checker-disable-next-line named-path-exists -- negative spec: the path object is refused as a pattern, never read
        const golden = file('./expected/text.txt');

        // Then - no pattern is made of it
        expect(() => 'text'.match(golden as never)).toThrow(/on a string, a value with no golden/u);
    });
});
