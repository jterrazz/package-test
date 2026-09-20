import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { installerAt, loadPeer, requireBuiltPeer } from './peer.js';

/** A project installed by the manager whose lockfile it carries. */
function projectWith(lockfile: string): string {
    const directory = mkdtempSync(join(tmpdir(), 'peer-'));
    writeFileSync(join(directory, 'package.json'), '{ "name": "consumer" }');
    writeFileSync(join(directory, lockfile), '');
    return directory;
}

describe('loadPeer — an optional peer, or a message that fixes it', () => {
    test('hands back what the import resolved, untouched', async () => {
        // Given - a peer that is installed
        const loaded = await loadPeer(
            'yaml',
            'a document',
            async () => await Promise.resolve({ parse: () => 42 }),
        );

        // Then - the loader is a pass-through on the happy path
        expect(loaded.parse()).toBe(42);
    });

    test('names the facet that asked, the peer, and the command', async () => {
        // Given - a peer that is not installed
        const failed = loadPeer(
            'redis',
            'redis()',
            async () => await Promise.reject(new Error("Cannot find module 'redis'")),
        );

        // Then - the reader has the line to add without leaving the message
        await expect(failed).rejects.toThrow(
            'redis() requires `redis`, an optional peer dependency of @jterrazz/test: npm install -D redis.',
        );
    });

    test('names the command of the package manager the project uses', () => {
        // Given - three projects, each carrying one package manager's lockfile
        // Then - the line the reader types is theirs to copy, not to translate
        expect(installerAt(projectWith('bun.lock')).command).toBe('bun add -d');
        expect(installerAt(projectWith('pnpm-lock.yaml')).command).toBe('pnpm add -D');
        expect(installerAt(projectWith('package-lock.json')).command).toBe('npm install -D');
    });

    test('keeps the original failure as the cause', async () => {
        // Given - a peer whose module is present but whose BINDING fails to load
        const original = new Error('Could not locate the bindings file');
        const failed = loadPeer(
            'better-sqlite3',
            'sqlite()',
            async () => await Promise.reject(original),
        );

        // Then - the resolver's own words survive, so a build failure is never read as a missing install
        await expect(failed).rejects.toHaveProperty('cause', original);
    });
});

/** `requireBuiltPeer` over a use that fails with `message`. */
const failingWith = (message: string) => (): void => {
    requireBuiltPeer('better-sqlite3', 'sqlite()', () => {
        throw new Error(message);
    });
};

describe('requireBuiltPeer — installed, and still not there', () => {
    test('names the peer, the facet and the command its manager needs', () => {
        // Given - a native peer whose binding was never compiled
        const fail = failingWith(
            'Could not locate the bindings file. Tried:\n → build/better_sqlite3.node',
        );

        // Then - the refusal says who asked, what is missing, and the line that fixes it
        expect(fail).toThrow(
            /sqlite\(\) found `better-sqlite3` but its native binding is not built/u,
        );
        expect(fail).toThrow(/rebuild better-sqlite3|bun pm trust|onlyBuiltDependencies/u);
    });

    test('leaves a failure that is not a missing binding alone', () => {
        // Given - the peer working, and the seam itself throwing
        const fail = failingWith('SQLITE_CANTOPEN: unable to open database file');

        // Then - the original error travels, unwrapped: it is not a build problem
        expect(fail).toThrow('SQLITE_CANTOPEN: unable to open database file');
    });

    test('says nothing when the binding loads', () => {
        // Given - a peer whose first use succeeds
        // Then - the guard is a pass-through
        expect(() => {
            requireBuiltPeer('better-sqlite3', 'sqlite()', () => {
                /* a binding that loads does nothing here */
            });
        }).not.toThrow();
    });
});
