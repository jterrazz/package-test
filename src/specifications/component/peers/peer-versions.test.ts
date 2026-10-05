import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { assertProviderPin, versionOf } from './peer-versions.js';

const peer = (name: string): string => resolve(import.meta.dirname, '_fixtures', name);

describe('peer-versions', () => {
    test('refuses a provider on another version than its runner, naming both and the one-change bump', () => {
        // Given - a runner and a provider a patch apart
        const runner = '4.1.0';

        // Then - the whole refusal: both versions, and one command moving both
        expect(() => {
            assertProviderPin(runner, '4.0.9');
        }).toThrow(
            [
                'found: component(): @vitest/browser-playwright is 4.0.9, and vitest is 4.1.0',
                'why: `@vitest/browser-playwright` peers vitest on an exact version.',
                'fix: bump both to the same version in one change: npm i -D vitest@4.0.9 @vitest/browser-playwright@4.0.9',
                'read: docs/start/set-up-a-project.md#what-to-install',
            ].join('\n'),
        );
    });

    test('refuses a provider that is not installed as a missing optional peer', () => {
        // Given - a runner with no provider installed beside it
        const runner = '4.1.0';

        // Then - the seam row, installing the provider at the runner's version
        expect(() => {
            assertProviderPin(runner, null);
        }).toThrow(
            [
                'found: component() requires `@vitest/browser-playwright`, and it is not installed',
                'why: Every seam is an optional peer of @jterrazz/test, installed by the project that specifies through it.',
                'fix: npm i -D @vitest/browser-playwright@4.1.0 playwright',
                'read: docs/reference/linting.md#seam-is-an-optional-peer',
            ].join('\n'),
        );
    });

    test("passes a provider on exactly its runner's version", () => {
        // Given - a runner and a provider on one version
        const runner = '4.1.0';

        // Then - nothing to refuse
        expect(() => {
            assertProviderPin(runner, runner);
        }).not.toThrow();
    });

    test('reads the version an installed manifest states', () => {
        // Given - a peer whose manifest states its version
        const specifier = peer('versioned');

        // Then - the version, as stated
        expect(versionOf(specifier)).toBe('1.2.3');
    });

    test.each(['no-version', 'null-manifest', 'text-manifest'])(
        'refuses an installed manifest that carries no version: %s',
        (name) => {
            // Given - a peer whose manifest is no object holding a version
            const specifier = peer(name);

            // Then - the refusal names the peer and the reinstall
            expect(() => versionOf(specifier)).toThrow(
                [
                    `found: the installed ${specifier} manifest carries no version`,
                    'why: The component project reads the version of the peers it configures from their installed manifests.',
                    `fix: reinstall ${specifier}: \`npm install ${specifier}\``,
                    'read: docs/start/set-up-a-project.md#what-to-install',
                ].join('\n'),
            );
        },
    );
});
