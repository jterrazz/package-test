import { directory, file } from '@jterrazz/test';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

const WHY =
    'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.';
const READ = 'read: docs/reference/linting.md#disk-named-by-relative-path-at-runtime';

describe('refused', () => {
    test('a path that is not relative to the spec file is refused before the chain holds it, naming the form to write', () => {
        // Given - a bare name where the spec names its fixture
        // Then - refused where it is written, with the relative form of the same path
        /* oxlint-disable jterrazz/verb-reads-its-ground-folder -- the run-time refusal of this very path is the subject */
        // @ts-expect-error -- a path the types refuse, refused at run time too
        expect(() => cli.fixture(file('invalid.ts'))).toThrow(
            [
                'found: file("invalid.ts"), a path that is not relative to the spec file',
                WHY,
                "fix: start it with ./ or ../, from the spec file: file('./invalid.ts')",
                READ,
            ].join('\n'),
        );
        /* oxlint-enable jterrazz/verb-reads-its-ground-folder */
    });

    test('a directory named without its slash, and a file named with one, are each refused naming the other', () => {
        // Given - each wrapper handed the other's path
        // Then - each names the call to write instead
        // @ts-expect-error -- a path the types refuse, refused at run time too
        expect(() => cli.fixture(directory('./__fixtures__/chain-ground'))).toThrow(
            [
                'found: directory("./__fixtures__/chain-ground"), a path that does not end in /',
                WHY,
                'fix: end it in /: directory("./__fixtures__/chain-ground/"), or name a file with file("./__fixtures__/chain-ground")',
                READ,
            ].join('\n'),
        );
        // checker-disable-next-line named-path-exists -- the refusal under test: a file() naming a directory is refused before the disk is read
        // @ts-expect-error -- a path the types refuse, refused at run time too
        expect(() => cli.fixture(file('./__fixtures__/chain-ground/'))).toThrow(
            [
                'found: file("./__fixtures__/chain-ground/"), a path ending in / — a directory\'s',
                WHY,
                'fix: name the directory with directory("./__fixtures__/chain-ground/"), or the file without its /: file("./__fixtures__/chain-ground")',
                READ,
            ].join('\n'),
        );
    });

    test('a path handed as a plain string is refused as a value, not read as the disk', () => {
        // Given - the fixture's path without the wrapper that says what it names
        // Then - the verb names the wrappers that read the disk
        // @ts-expect-error -- a path the types refuse, refused at run time too
        expect(() => cli.fixture('./__fixtures__/chain-ground/')).toThrow(
            [
                'found: fixture("./__fixtures__/chain-ground/"), a value where the disk is read',
                WHY,
                "fix: name the disk: fixture(file('./…')) for a file, fixture(directory('./…/')) for a directory",
                READ,
            ].join('\n'),
        );
    });

    test('a path naming the other kind on disk than it says is refused when the chain runs, naming the form that matches', async () => {
        // Given - a directory named as a file, and a file named as a directory
        // Then - each refusal names what the disk holds, and the call that reads it
        // checker-disable-next-line named-path-exists -- the kind on disk is the refusal under test: the path names the other kind on purpose
        await expect(cli.fixture(file('./__fixtures__/chain-ground')).exec('help')).rejects.toThrow(
            [
                'found: fixture: "./__fixtures__/chain-ground" names a directory',
                WHY,
                "fix: end its path in /: directory('./__fixtures__/chain-ground/') — its contents are spread into the working directory",
                READ,
            ].join('\n'),
        );
        // checker-disable-next-line named-path-exists -- the kind on disk is the refusal under test: the path names the other kind on purpose
        const fileAsDirectory = cli.fixture(directory('./__fixtures__/invalid.ts/'));
        await expect(fileAsDirectory.exec('help')).rejects.toThrow(
            [
                'found: fixture: "./__fixtures__/invalid.ts/" names a file',
                WHY,
                "fix: drop the /: file('./__fixtures__/invalid.ts')",
                READ,
            ].join('\n'),
        );
    });

    test('a path that names nothing is refused with the path it resolved to', async () => {
        // Given - a fixture the leaf does not hold
        const resolved = resolve(import.meta.dirname, '__fixtures__/absent.txt');

        // Then - refused before the binary runs, naming where it looked
        // checker-disable-next-line named-path-exists -- the absence is the refusal under test
        await expect(cli.fixture(file('./__fixtures__/absent.txt')).exec('help')).rejects.toThrow(
            [
                `found: fixture: "./__fixtures__/absent.txt" names nothing — ${resolved} does not exist`,
                WHY,
                `fix: create ${resolved}, or correct the path`,
                READ,
            ].join('\n'),
        );
    });
});
