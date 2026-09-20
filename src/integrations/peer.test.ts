import { describe, expect, test } from 'vitest';

import { loadPeer } from './peer.js';

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
