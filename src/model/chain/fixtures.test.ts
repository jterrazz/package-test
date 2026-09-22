import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { copyPlan } from './fixtures.js';

describe('fixtures — source resolution', () => {
    let base: string;
    let specsRoot: string;
    let testDir: string;

    beforeAll(() => {
        // Given - a specs/ tree with a shared pool and a feature-local fixtures dir
        base = mkdtempSync(resolve(tmpdir(), 'fixtures-'));
        specsRoot = resolve(base, 'specs');
        testDir = resolve(specsRoot, 'cli/feature');
        mkdirSync(resolve(specsRoot, 'fixtures/cli-app'), { recursive: true });
        mkdirSync(resolve(testDir, 'fixtures'), { recursive: true });
    });

    afterAll(() => {
        rmSync(base, { force: true, recursive: true });
    });

    test('a path beside the spec resolves from the spec directory', () => {
        // Given - a feature-local file, named from the spec
        // Then - it resolves against the spec's own directory
        expect(copyPlan('./fixtures/local.txt', testDir, '/work').src).toBe(
            resolve(testDir, 'fixtures/local.txt'),
        );
    });

    test('the shared pool is reached by the path that climbs to it', () => {
        // Given - a pool directory, named from two levels down
        // Then - the trailing slash does not affect where the source is read
        expect(copyPlan('../../fixtures/cli-app/', testDir, '/work').src).toBe(
            resolve(specsRoot, 'fixtures/cli-app'),
        );
    });

    test.each(['local.txt', '$FIXTURES/cli-app/', '/abs/file.txt'])(
        'a path that is not relative is refused: %s',
        (path) => {
            // Given - a name that leaves its folder implicit
            // Then - the refusal says how a file is named
            expect(() => copyPlan(path, testDir, '/work')).toThrow(
                /a file is named by a path relative to the spec file/u,
            );
        },
    );
});

describe('fixtures — copy semantics (rsync trailing slash)', () => {
    let base: string;
    let testDir: string;
    let workDir: string;

    beforeAll(() => {
        base = mkdtempSync(resolve(tmpdir(), 'fixtures-copy-'));
        testDir = resolve(base, 'specs/cli/feature');
        mkdirSync(resolve(testDir, 'fixtures/proj/nested'), { recursive: true });
        writeFileSync(resolve(testDir, 'fixtures/proj/a.txt'), 'a\n');
        writeFileSync(resolve(testDir, 'fixtures/proj/nested/b.txt'), 'b\n');
        writeFileSync(resolve(testDir, 'fixtures/single.txt'), 'single\n');
    });

    afterAll(() => {
        rmSync(base, { force: true, recursive: true });
    });

    function freshWorkDir(): string {
        workDir = mkdtempSync(resolve(tmpdir(), 'fixtures-work-'));
        return workDir;
    }

    test('a plain file is copied as <cwd>/<basename>', () => {
        // Given - a single file fixture
        const { dest, src } = copyPlan('./fixtures/single.txt', testDir, freshWorkDir());
        cpSync(src, dest, { recursive: true });

        // Then - it lands at the working dir under its basename
        expect(dest).toBe(resolve(workDir, 'single.txt'));
        expect(readFileSync(resolve(workDir, 'single.txt'), 'utf8')).toBe('single\n');
    });

    test('a document directory without a trailing slash is copied as <cwd>/<basename>', () => {
        // Given - a directory fixture, no trailing slash
        const { dest, src } = copyPlan('./fixtures/proj', testDir, freshWorkDir());
        cpSync(src, dest, { recursive: true });

        // Then - the directory itself appears under the cwd
        expect(dest).toBe(resolve(workDir, 'proj'));
        expect(readFileSync(resolve(workDir, 'proj/a.txt'), 'utf8')).toBe('a\n');
        expect(readFileSync(resolve(workDir, 'proj/nested/b.txt'), 'utf8')).toBe('b\n');
    });

    test('a directory with a trailing slash spreads its contents into the cwd', () => {
        // Given - a directory fixture in spread form
        const { dest, src } = copyPlan('./fixtures/proj/', testDir, freshWorkDir());
        cpSync(src, dest, { recursive: true });

        // Then - the contents land directly in the cwd, not under proj/
        expect(dest).toBe(workDir);
        expect(readFileSync(resolve(workDir, 'a.txt'), 'utf8')).toBe('a\n');
        expect(readFileSync(resolve(workDir, 'nested/b.txt'), 'utf8')).toBe('b\n');
    });
});
