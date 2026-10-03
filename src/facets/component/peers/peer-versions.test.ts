import { describe, expect, test } from 'vitest';

import { assertProviderPin } from './peer-versions.js';

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
                'read: docs/06-setting-up.md#what-to-install',
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
                'read: docs/24-linting.md#seam-is-an-optional-peer',
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
});
