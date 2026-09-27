import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { copyPlan, fsFixtures } from './fs-fixtures.adapter.js';

let base: string;
let specsRoot: string;
let testDir: string;
let copyBase: string;
let copyDir: string;
let workDir: string;

function freshWorkDir(): string {
    workDir = mkdtempSync(resolve(tmpdir(), 'fixtures-work-'));
    return workDir;
}

describe('fsFixtures', () => {
    beforeAll(() => {
        // Given - a specs/ tree with a shared pool and a feature-local fixtures dir
        base = mkdtempSync(resolve(tmpdir(), 'fixtures-'));
        specsRoot = resolve(base, 'specs');
        testDir = resolve(specsRoot, 'cli/feature');
        mkdirSync(resolve(specsRoot, '_fixtures/cli-app'), { recursive: true });
        mkdirSync(resolve(testDir, '_fixtures'), { recursive: true });
        writeFileSync(resolve(testDir, '_fixtures/local.txt'), 'local\n');
        copyBase = mkdtempSync(resolve(tmpdir(), 'fixtures-copy-'));
        copyDir = resolve(copyBase, 'specs/cli/feature');
        mkdirSync(resolve(copyDir, '_fixtures/proj/nested'), { recursive: true });
        writeFileSync(resolve(copyDir, '_fixtures/proj/a.txt'), 'a\n');
        writeFileSync(resolve(copyDir, '_fixtures/proj/nested/b.txt'), 'b\n');
        writeFileSync(resolve(copyDir, '_fixtures/single.txt'), 'single\n');
    });

    afterAll(() => {
        rmSync(base, { force: true, recursive: true });
        rmSync(copyBase, { force: true, recursive: true });
    });

    test('copyPlan — source resolution — a path beside the spec resolves from the spec directory', () => {
        // Given - a feature-local file, named from the spec
        // Then - it resolves against the spec's own directory
        expect(copyPlan('./_fixtures/local.txt', testDir, '/work').src).toBe(
            resolve(testDir, '_fixtures/local.txt'),
        );
    });

    test('copyPlan — source resolution — the shared pool is reached by the path that climbs to it', () => {
        // Given - a pool directory, named from two levels down
        // Then - the trailing slash does not affect where the source is read
        expect(copyPlan('../../_fixtures/cli-app/', testDir, '/work').src).toBe(
            resolve(specsRoot, '_fixtures/cli-app'),
        );
    });

    test.each(['local.txt', '$FIXTURES/cli-app/', '/abs/file.txt'])(
        'fixtures — source resolution — a path that is not relative is refused: %s',
        (path) => {
            // Given - a name that leaves its folder implicit
            // Then - the refusal says how a file is named
            expect(() => copyPlan(path, testDir, '/work')).toThrow(
                /a path that is not relative to the spec file/u,
            );
        },
    );

    test('copyPlan — source resolution — a path that names nothing is refused with the path it resolved to', () => {
        // Given - a file the leaf does not carry
        // Then - the refusal carries the absolute path it looked at
        expect(() => copyPlan('./_fixtures/absent.txt', testDir, '/work')).toThrow(
            `found: fixture: "./_fixtures/absent.txt" names nothing — ${resolve(testDir, '_fixtures/absent.txt')} does not exist`,
        );
    });

    test('fsFixtures — copy semantics (the trailing slash says which) — a plain file is copied as <cwd>/<basename>', () => {
        // Given - a single file fixture
        fsFixtures.layer('./_fixtures/single.txt', copyDir, freshWorkDir());

        // Then - it lands at the working dir under its basename
        expect(readFileSync(resolve(workDir, 'single.txt'), 'utf8')).toBe('single\n');
    });

    test('copyPlan — copy semantics (the trailing slash says which) — a directory named without its trailing slash is refused, naming the form to write', () => {
        // Given - a directory fixture, no trailing slash
        // Then - the path says one kind and the disk the other
        expect(() => copyPlan('./_fixtures/proj', copyDir, freshWorkDir())).toThrow(
            /names a directory\n.*\nfix: end its path in \/: directory\('\.\/_fixtures\/proj\/'\)/u,
        );
    });

    test('copyPlan — copy semantics (the trailing slash says which) — a file named with a trailing slash is refused', () => {
        // Given - a file fixture in spread form
        // Then - the refusal names file()
        expect(() => copyPlan('./_fixtures/single.txt/', copyDir, freshWorkDir())).toThrow(
            /names a file\n.*\nfix: drop the \/: file\('\.\/_fixtures\/single\.txt'\)/u,
        );
    });

    test('fsFixtures — copy semantics (the trailing slash says which) — a directory with a trailing slash spreads its contents into the cwd', () => {
        // Given - a directory fixture in spread form
        fsFixtures.layer('./_fixtures/proj/', copyDir, freshWorkDir());

        // Then - the contents land directly in the cwd, not under proj/
        expect(existsSync(resolve(workDir, 'proj'))).toBe(false);
        expect(readFileSync(resolve(workDir, 'a.txt'), 'utf8')).toBe('a\n');
        expect(readFileSync(resolve(workDir, 'nested/b.txt'), 'utf8')).toBe('b\n');
    });
});
