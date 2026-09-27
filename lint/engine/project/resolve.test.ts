import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { discoverRoot, resolveRoot } from './resolve.js';

let base: string;

describe('resolve', () => {
    beforeAll(() => {
        // Given - <base>/project with a manifest and a nested tests dir, and <base>/plain with only a package.json
        base = mkdtempSync(resolve(tmpdir(), 'root-discovery-'));
        mkdirSync(resolve(base, 'project/tests/feature'), { recursive: true });
        writeFileSync(resolve(base, 'project/package.json'), '{"name":"project"}\n');
        mkdirSync(resolve(base, 'plain/tests/deep'), { recursive: true });
        writeFileSync(resolve(base, 'plain/package.json'), '{"name":"plain"}\n');
    });

    afterAll(() => {
        rmSync(base, { force: true, recursive: true });
    });

    test('root discovery (rule `no-redundant-root`) — walks up to the nearest directory carrying a root marker', () => {
        // Given - a specification file nested under the project
        const found = discoverRoot(resolve(base, 'project/tests/feature'));

        // Then - the project directory wins
        expect(found).toBe(resolve(base, 'project'));
    });

    test('root discovery (rule `no-redundant-root`) — a directory carrying a package.json is a root', () => {
        // Given - a plain project
        const found = discoverRoot(resolve(base, 'plain/tests/deep'));

        // Then - the package.json directory wins
        expect(found).toBe(resolve(base, 'plain'));
    });

    test('root discovery (rule `no-redundant-root`) — resolveRoot treats an explicit root as an override', () => {
        // Given - an explicit relative root
        const found = resolveRoot('../..', resolve(base, 'project/tests/feature'));

        // Then - it resolves from the caller directory, no discovery
        expect(found).toBe(resolve(base, 'project'));
    });

    test('root discovery (rule `no-redundant-root`) — resolveRoot without a root auto-discovers from the caller directory', () => {
        // Given - no explicit root
        const found = resolveRoot(undefined, resolve(base, 'project/tests/feature'));

        // Then - discovery kicks in
        expect(found).toBe(resolve(base, 'project'));
    });

    test('root discovery (rule `no-redundant-root`) — falls back to the starting directory when no marker exists anywhere up', () => {
        // Given - a bare temp tree with no package.json above it
        const bare = mkdtempSync(resolve(tmpdir(), 'no-marker-'));
        try {
            // Then - the starting directory itself is the root
            expect(discoverRoot(bare)).toBe(bare);
        } finally {
            rmSync(bare, { force: true, recursive: true });
        }
    });

    test('root discovery (rule `no-redundant-root`) — a workspace package wins over the repository above it (monorepo)', () => {
        // Given - a manifest at the monorepo root and one in a nested package (the shape where walking past the first marker measures every path the runner resolves from the wrong unit)
        mkdirSync(resolve(base, 'mono'), { recursive: true });
        writeFileSync(resolve(base, 'mono/package.json'), '{"name":"mono"}\n');
        mkdirSync(resolve(base, 'mono/packages/pkg/src'), { recursive: true });
        writeFileSync(resolve(base, 'mono/packages/pkg/package.json'), '{"name":"pkg"}\n');

        // Then - the package being tested is the root
        expect(discoverRoot(resolve(base, 'mono/packages/pkg/src'))).toBe(
            resolve(base, 'mono/packages/pkg'),
        );
    });

    test('root discovery (rule `no-redundant-root`) — the marker in a directory resolves to that directory', () => {
        // Given - the ordinary single-package repo
        // Then - the nearest ancestor carrying the manifest is the root
        expect(discoverRoot(resolve(base, 'project/tests/feature'))).toBe(resolve(base, 'project'));
    });

    test('root discovery (rule `no-redundant-root`) — in a git checkout, a `.gitignore`d manifest marks no root and a new one does', () => {
        // Given - a repository whose `pkg/package.json` is ignored, and a `fresh/` package nobody added
        const repository = resolve(base, 'repository');
        mkdirSync(resolve(repository, 'pkg/src'), { recursive: true });
        mkdirSync(resolve(repository, 'fresh/src'), { recursive: true });
        writeFileSync(resolve(repository, 'package.json'), '{"name":"repository"}\n');
        writeFileSync(resolve(repository, 'pkg/package.json'), '{"name":"pkg"}\n');
        writeFileSync(resolve(repository, 'fresh/package.json'), '{"name":"fresh"}\n');
        writeFileSync(resolve(repository, '.gitignore'), 'pkg/package.json\n');
        execFileSync('git', ['init', '--quiet'], { cwd: repository });

        // Then - the walk passes the ignored marker, and stops at the unstaged one
        expect(discoverRoot(resolve(repository, 'pkg/src'))).toBe(repository);
        expect(discoverRoot(resolve(repository, 'fresh/src'))).toBe(resolve(repository, 'fresh'));
    });

    test('root discovery (rule `no-redundant-root`) — an absolute root override is used verbatim', () => {
        // Given - an absolute root and an unrelated caller directory
        const found = resolveRoot(resolve(base, 'project'), resolve(base, 'plain/tests/deep'));

        // Then - the override wins with no resolution against the caller
        expect(found).toBe(resolve(base, 'project'));
    });
});
