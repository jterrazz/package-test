import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { copyPlan, discoverSpecsRoot, resolveFixtureSource } from './fixtures.js';

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
        writeFileSync(resolve(specsRoot, 'fixtures/cli-app/cli.sh'), '#!/bin/sh\n');
        writeFileSync(resolve(specsRoot, 'fixtures/shared.txt'), 'shared\n');
        writeFileSync(resolve(testDir, 'fixtures/local.txt'), 'local\n');
    });

    afterAll(() => {
        rmSync(base, { force: true, recursive: true });
    });

    test('a feature-local path resolves under <test-dir>/fixtures/', () => {
        // Given - a bare path with no marker
        // Then - it resolves against the test directory
        expect(resolveFixtureSource('local.txt', testDir)).toBe(
            resolve(testDir, 'fixtures/local.txt'),
        );
    });

    test('a $FIXTURES file resolves under <specs-root>/fixtures/', () => {
        // Given - a shared-pool file
        // Then - it resolves against the discovered specs root
        expect(resolveFixtureSource('$FIXTURES/shared.txt', testDir)).toBe(
            resolve(specsRoot, 'fixtures/shared.txt'),
        );
    });

    test('a $FIXTURES directory with a trailing slash resolves the directory itself', () => {
        // Given - a shared-pool directory spread form
        // Then - the trailing slash does not affect source resolution
        expect(resolveFixtureSource('$FIXTURES/cli-app/', testDir)).toBe(
            resolve(specsRoot, 'fixtures/cli-app'),
        );
    });

    test('discoverSpecsRoot walks up to the nearest specs directory', () => {
        // Given - a deeply nested test directory
        // Then - the ancestor named specs wins
        expect(discoverSpecsRoot(testDir)).toBe(specsRoot);
    });

    test('an unknown marker is a clear usage error listing known markers', () => {
        // Given - a path with a bogus marker
        // Then - the error names the marker and the known set
        expect(() => resolveFixtureSource('$SHARED/x.txt', testDir)).toThrow(
            /unknown marker "\$SHARED".*Known markers: \$FIXTURES/s,
        );
    });

    test('$FIXTURES with no specs directory above throws with guidance', () => {
        // Given - a bare directory with no specs ancestor
        const bare = mkdtempSync(resolve(tmpdir(), 'no-specs-'));
        try {
            // Then - the error explains the marker needs a specs root
            expect(() => resolveFixtureSource('$FIXTURES/x.txt', bare)).toThrow(
                /no directory named "specs"/,
            );
        } finally {
            rmSync(bare, { force: true, recursive: true });
        }
    });
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
        writeFileSync(resolve(testDir, 'fixtures/single-v2.txt'), 'v2\n');
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
        const { dest, src } = copyPlan('single.txt', testDir, freshWorkDir());
        cpSync(src, dest, { recursive: true });

        // Then - it lands at the working dir under its basename
        expect(dest).toBe(resolve(workDir, 'single.txt'));
        expect(readFileSync(resolve(workDir, 'single.txt'), 'utf8')).toBe('single\n');
    });

    test('a directory without a trailing slash is copied as <cwd>/<basename>', () => {
        // Given - a directory fixture, no trailing slash
        const { dest, src } = copyPlan('proj', testDir, freshWorkDir());
        cpSync(src, dest, { recursive: true });

        // Then - the directory itself appears under the cwd
        expect(dest).toBe(resolve(workDir, 'proj'));
        expect(readFileSync(resolve(workDir, 'proj/a.txt'), 'utf8')).toBe('a\n');
        expect(readFileSync(resolve(workDir, 'proj/nested/b.txt'), 'utf8')).toBe('b\n');
    });

    test('a directory with a trailing slash spreads its contents into the cwd', () => {
        // Given - a directory fixture in spread form
        const { dest, src } = copyPlan('proj/', testDir, freshWorkDir());
        cpSync(src, dest, { recursive: true });

        // Then - the contents land directly in the cwd, not under proj/
        expect(dest).toBe(workDir);
        expect(readFileSync(resolve(workDir, 'a.txt'), 'utf8')).toBe('a\n');
        expect(readFileSync(resolve(workDir, 'nested/b.txt'), 'utf8')).toBe('b\n');
    });
});
