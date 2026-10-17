import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { fsFixtures } from '../fs-fixtures.adapter.js';

const DISK_WHY =
    'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.';

const DISK_CHAPTER = 'read: docs/reference/linting.md#disk-named-by-relative-path-at-runtime';

function workDirectory(): string {
    return mkdtempSync(join(tmpdir(), 'fixtures-work-'));
}

function refusalOf(path: string): string {
    try {
        fsFixtures.layer(path, import.meta.dirname, workDirectory());
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('fsFixtures', () => {
    test('fs-fixtures — a fixture laid in the working directory — a file copied by its name, a directory spread', () => {
        // Given - a working directory, and a file and a directory beside the spec
        const workDir = workDirectory();

        // When - each is laid
        fsFixtures.layer('./__fixtures__/config.json', import.meta.dirname, workDir);
        fsFixtures.layer('./__fixtures__/shop/', import.meta.dirname, workDir);

        // Then - the file under its own name, the directory's contents at the root
        expect([
            readdirSync(workDir).toSorted(),
            readFileSync(join(workDir, 'config.json'), 'utf8') ===
                readFileSync(join(import.meta.dirname, '__fixtures__/config.json'), 'utf8'),
        ]).toStrictEqual([['config.json', 'index.txt'], true]);
    });

    test('fs-fixtures — a fixture laid in the working directory — refuses a path naming nothing, the other kind, or not relative', () => {
        // Given - paths naming nothing, a directory as a file, a file as a directory, and the root
        const absent = join(import.meta.dirname, '__fixtures__/absent.json');

        // Then - each refusal whole
        expect([
            refusalOf('./__fixtures__/absent.json'),
            refusalOf('./__fixtures__/shop'),
            refusalOf('./__fixtures__/config.json//'),
            refusalOf('/__fixtures__/config.json'),
        ]).toStrictEqual([
            [
                `found: fixture: "./__fixtures__/absent.json" names nothing: ${absent} does not exist`,
                DISK_WHY,
                `fix: create ${absent}, or correct the path`,
                DISK_CHAPTER,
            ].join('\n'),
            [
                'found: fixture: "./__fixtures__/shop" names a directory',
                DISK_WHY,
                "fix: end its path in /: directory('./__fixtures__/shop/'), whose contents are spread into the working directory",
                DISK_CHAPTER,
            ].join('\n'),
            [
                'found: fixture: "./__fixtures__/config.json//" names a file',
                DISK_WHY,
                "fix: drop the /: file('./__fixtures__/config.json')",
                DISK_CHAPTER,
            ].join('\n'),
            [
                'found: fixture("/__fixtures__/config.json"), a path that is not relative to the spec file',
                DISK_WHY,
                "fix: start it with ./ or ../, from the spec file: fixture('./__fixtures__/config.json')",
                DISK_CHAPTER,
            ].join('\n'),
        ]);
    });
});
