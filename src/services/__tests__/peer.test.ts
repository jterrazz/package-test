import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { installerAt, loadPeer, requireBuiltPeer } from '../peer.js';

function projectWith(lockfile?: string): string {
    const directory = mkdtempSync(join(tmpdir(), 'peer-'));
    writeFileSync(join(directory, 'package.json'), '{ "name": "consumer" }');
    if (lockfile !== undefined) {
        writeFileSync(join(directory, lockfile), '');
    }
    return directory;
}

function unbuilt(message: string, from: string, peer = 'better-sqlite3'): string {
    try {
        requireBuiltPeer(
            peer,
            'sqlite()',
            () => {
                throw new Error(message);
            },
            from,
        );
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

async function missing(peer: string, from: string): Promise<string> {
    try {
        await loadPeer(
            peer,
            'the specification',
            async () => await Promise.reject(new Error(`Cannot find module '${peer}'`)),
            from,
        );
        return '';
    } catch (error) {
        return error instanceof Error
            ? (error.message.split('\n').find((line) => line.startsWith('fix: ')) ?? '')
            : String(error);
    }
}

const notBuilt = (manager: string, fix: string): string =>
    [
        'found: sqlite() found `better-sqlite3`, and its native binding is not built',
        `why: A native peer is built by its install script, and ${manager} runs a dependency's install script only once it is told to.`,
        `fix: ${fix}`,
        'read: docs/start/set-up-a-project.md#what-to-install',
    ].join('\n');

describe('peer', () => {
    test('loadPeer — an optional peer, or a message that fixes it — hands back what the import resolved, untouched', async () => {
        // Given - a peer that is installed
        const loaded = await loadPeer('yaml', 'a document', async () => ({ parse: () => 42 }));

        // Then - the loader is a pass-through on the happy path
        expect(loaded.parse()).toBe(42);
    });

    // RUNTIME seam-is-an-optional-peer — a missing peer is refused where it was needed, naming the peer and the install command.
    test('loadPeer — an optional peer, or a message that fixes it — names the specification that asked, the peer, and the command, keeping the original failure as the cause', async () => {
        // Given - a peer that is not installed
        const original = new Error("Cannot find module 'redis'");
        const failed = loadPeer(
            'redis',
            'redis()',
            async () => await Promise.reject(original),
            projectWith('package-lock.json'),
        );

        // Then - the reader has the line to add without leaving the message, and the resolver's own words survive
        await expect(failed).rejects.toThrow(
            [
                'found: redis() requires `redis`, and it is not installed',
                'why: Every seam is an optional peer of @jterrazz/test, installed by the project that specifies through it.',
                'fix: npm install -D redis',
                'read: docs/reference/linting.md#seam-is-an-optional-peer',
            ].join('\n'),
        );
        await expect(failed).rejects.toHaveProperty('cause', original);
    });

    test("loadPeer — the install line is the project's manager's, and a native peer under pnpm is told to be built", async () => {
        // Given - projects of each manager, and one with no lockfile
        // Then - each line to copy
        expect([
            await missing('redis', projectWith('bun.lock')),
            await missing('redis', projectWith('bun.lockb')),
            await missing('redis', projectWith('yarn.lock')),
            await missing('redis', projectWith()),
            await missing('redis', projectWith('pnpm-lock.yaml')),
            await missing('better-sqlite3', projectWith('pnpm-lock.yaml')),
            await missing('better-sqlite3', projectWith('yarn.lock')),
        ]).toStrictEqual([
            'fix: bun add -d redis',
            'fix: bun add -d redis',
            'fix: yarn add -D redis',
            'fix: npm install -D redis',
            'fix: pnpm add -D redis',
            'fix: pnpm add -D better-sqlite3; under pnpm the binding is not built unless the package is listed: add "better-sqlite3" to `onlyBuiltDependencies` in package.json (or `only-built-dependencies` in .npmrc) and reinstall',
            'fix: yarn add -D better-sqlite3',
        ]);
    });

    test('installerAt — a folder under no project installs with npm', () => {
        // Given - the file system's root, above every project
        // Then - the default installer
        expect(installerAt('/')).toStrictEqual({ command: 'npm install -D', name: 'npm' });
    });

    test('requireBuiltPeer — installed, and still not there — names the peer, the specification and the build command its manager needs, keeping the cause', () => {
        // Given - a native peer whose binding was never compiled, under each manager
        const message = 'Could not locate the bindings file. Tried:\n → build/better_sqlite3.node';

        const original = new Error(message);
        const guarded = (): void => {
            requireBuiltPeer(
                'better-sqlite3',
                'sqlite()',
                () => {
                    throw original;
                },
                projectWith('package-lock.json'),
            );
        };

        // Then - the refusal says who asked, what is missing, and the line that fixes it, the binding's failure its cause
        expect(guarded).toThrow(expect.objectContaining({ cause: original }));
        expect([
            unbuilt(message, projectWith('package-lock.json')),
            unbuilt(message, projectWith('bun.lock')),
            unbuilt(message, projectWith('yarn.lock')),
            unbuilt(message, projectWith('pnpm-lock.yaml')),
        ]).toStrictEqual([
            notBuilt(
                'npm',
                'npm install-scripts approve better-sqlite3 && npm rebuild better-sqlite3',
            ),
            notBuilt('bun', 'bun pm trust better-sqlite3'),
            notBuilt('yarn', 'yarn rebuild better-sqlite3'),
            notBuilt(
                'pnpm',
                'add "better-sqlite3" to `onlyBuiltDependencies` in package.json (or `only-built-dependencies` in .npmrc), then `pnpm rebuild better-sqlite3`',
            ),
        ]);
    });

    test('requireBuiltPeer — installed, and still not there — leaves a failure that is not a missing binding alone, and says nothing when the binding loads', () => {
        // Given - the seam itself throwing, and a peer whose first use succeeds
        const project = projectWith('package-lock.json');

        // Then - the original error travels, unwrapped, and the guard is a pass-through
        expect(unbuilt('SQLITE_CANTOPEN: unable to open database file', project)).toBe(
            'SQLITE_CANTOPEN: unable to open database file',
        );
        expect(() => {
            requireBuiltPeer('better-sqlite3', 'sqlite()', () => {
                /* invariant: a binding that loads does nothing here */
            });
        }).not.toThrow();
    });
});
