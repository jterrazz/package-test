import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { discoverRoot, findRoot, resolveCommand, resolveRoot } from './resolve.js';

/** A virtual filesystem: the probe the caller injects (fs, or a lint cache). */
const probe =
    (...present: string[]) =>
    (path: string): boolean =>
        present.includes(path);

describe('findRoot — the one walk both the runner and A9 use', () => {
    test('probes both markers at each ancestor, and the nearest one wins', () => {
        // Given - a compose file at the monorepo root and a manifest in the package
        const exists = probe('/mono/docker/compose.test.yaml', '/mono/apps/cli/package.json');

        // Then - the walk stops at the package, not at the repository
        expect(findRoot('/mono/apps/cli/specs/logs', exists)).toBe('/mono/apps/cli');
    });

    test('accepts either marker alone', () => {
        // Given - one ancestor carrying only a compose file
        // Then - it is a root all the same
        expect(findRoot('/stack/specs', probe('/stack/docker/compose.test.yaml'))).toBe('/stack');
    });

    test('returns undefined when no ancestor carries a marker', () => {
        // Given - a probe that finds nothing
        // Then - there is no root to derive, and the caller decides the fallback
        expect(findRoot('/nowhere/at/all', probe())).toBeUndefined();
    });

    test('a directory carrying a marker is its own root', () => {
        // Given - the starting directory itself declares the package
        // Then - the walk does not climb past it
        expect(findRoot('/pkg', probe('/pkg/package.json'))).toBe('/pkg');
    });
});

describe('root discovery (CONVENTIONS A9)', () => {
    let base: string;

    beforeAll(() => {
        // Given - <base>/project with docker/compose.test.yaml, nested tests dir,
        // And <base>/plain with only a package.json
        base = mkdtempSync(resolve(tmpdir(), 'root-discovery-'));
        mkdirSync(resolve(base, 'project/docker'), { recursive: true });
        mkdirSync(resolve(base, 'project/tests/feature'), { recursive: true });
        writeFileSync(resolve(base, 'project/docker/compose.test.yaml'), 'services: {}\n');
        writeFileSync(resolve(base, 'project/package.json'), '{"name":"project"}\n');
        mkdirSync(resolve(base, 'plain/tests/deep'), { recursive: true });
        writeFileSync(resolve(base, 'plain/package.json'), '{"name":"plain"}\n');
    });

    afterAll(() => {
        rmSync(base, { force: true, recursive: true });
    });

    test('walks up to the nearest directory carrying a root marker', () => {
        // Given - a specification file nested under the project
        const found = discoverRoot(resolve(base, 'project/tests/feature'));

        // Then - the project directory wins
        expect(found).toBe(resolve(base, 'project'));
    });

    test('a directory with only a package.json is a root', () => {
        // Given - a project without a compose file
        const found = discoverRoot(resolve(base, 'plain/tests/deep'));

        // Then - the package.json directory wins
        expect(found).toBe(resolve(base, 'plain'));
    });

    test('resolveRoot treats an explicit root as an override', () => {
        // Given - an explicit relative root
        const found = resolveRoot('../..', resolve(base, 'project/tests/feature'));

        // Then - it resolves from the caller directory, no discovery
        expect(found).toBe(resolve(base, 'project'));
    });

    test('resolveRoot without a root auto-discovers from the caller directory', () => {
        // Given - no explicit root
        const found = resolveRoot(undefined, resolve(base, 'project/tests/feature'));

        // Then - discovery kicks in
        expect(found).toBe(resolve(base, 'project'));
    });

    test('falls back to the starting directory when no marker exists anywhere up', () => {
        // Given - a bare temp tree with neither compose file nor package.json above it
        const bare = mkdtempSync(resolve(tmpdir(), 'no-marker-'));
        try {
            // Then - the starting directory itself is the root
            expect(discoverRoot(bare)).toBe(bare);
        } finally {
            rmSync(bare, { force: true, recursive: true });
        }
    });

    test('a workspace package wins over a compose file further up (monorepo)', () => {
        // Given - compose at the monorepo root, package.json in a nested package
        // (the shape that used to resolve to the repository: the walk ran twice,
        // Compose first, so the FURTHER marker decided and every path the runner
        // Resolved was measured from the wrong unit)
        mkdirSync(resolve(base, 'mono/docker'), { recursive: true });
        writeFileSync(resolve(base, 'mono/docker/compose.test.yaml'), 'services: {}\n');
        mkdirSync(resolve(base, 'mono/packages/pkg/src'), { recursive: true });
        writeFileSync(resolve(base, 'mono/packages/pkg/package.json'), '{"name":"pkg"}\n');

        // Then - the package being tested is the root
        expect(discoverRoot(resolve(base, 'mono/packages/pkg/src'))).toBe(
            resolve(base, 'mono/packages/pkg'),
        );
    });

    test('a compose file still anchors a directory that declares no package.json', () => {
        // Given - a test stack with no manifest beside it, under a plain parent
        mkdirSync(resolve(base, 'stack/docker'), { recursive: true });
        mkdirSync(resolve(base, 'stack/tests/deep'), { recursive: true });
        writeFileSync(resolve(base, 'stack/docker/compose.test.yaml'), 'services: {}\n');

        // Then - the compose file is a root marker in its own right
        expect(discoverRoot(resolve(base, 'stack/tests/deep'))).toBe(resolve(base, 'stack'));
    });

    test('both markers in one directory resolve to that directory', () => {
        // Given - the ordinary single-package repo: manifest and stack together
        // Then - the nearest ancestor carrying either marker is the root
        expect(discoverRoot(resolve(base, 'project/tests/feature'))).toBe(resolve(base, 'project'));
    });

    test('an absolute root override is used verbatim', () => {
        // Given - an absolute root and an unrelated caller directory
        const found = resolveRoot(resolve(base, 'project'), resolve(base, 'plain/tests/deep'));

        // Then - the override wins with no resolution against the caller
        expect(found).toBe(resolve(base, 'project'));
    });
});

describe('command resolution', () => {
    let base: string;

    beforeAll(() => {
        // Given - a root whose node_modules/.bin contains a tool
        base = mkdtempSync(resolve(tmpdir(), 'command-resolution-'));
        mkdirSync(resolve(base, 'node_modules/.bin'), { recursive: true });
        writeFileSync(resolve(base, 'node_modules/.bin/mytool'), '#!/bin/sh\n');
    });

    afterAll(() => {
        rmSync(base, { force: true, recursive: true });
    });

    test('absolute commands pass through untouched', () => {
        // Given - an absolute binary path
        // Then - it is returned as-is
        expect(resolveCommand('/usr/bin/env', base)).toBe('/usr/bin/env');
    });

    test('prefers the root node_modules/.bin when the command exists there', () => {
        // Given - mytool present under <root>/node_modules/.bin
        // Then - the local bin path wins over bare PATH resolution
        expect(resolveCommand('mytool', base)).toBe(resolve(base, 'node_modules/.bin/mytool'));
    });

    test('falls back to the bare command for PATH resolution', () => {
        // Given - a command absent from every node_modules/.bin
        // Then - the bare name is returned for the shell to resolve
        expect(resolveCommand('definitely-not-installed-xyz', base)).toBe(
            'definitely-not-installed-xyz',
        );
    });
});
