import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { declaredRange, toolchainRange } from './oxlint-pin.js';

/** The repository root, from this module's place inside `src/lint/`. */
const ROOT = resolve(import.meta.dirname, '../..');

/** A throwaway install whose two manifests state the ranges a case needs. */
function installWith(own: string, toolchain: string): string {
    const root = mkdtempSync(resolve(tmpdir(), 'oxlint-pin-'));
    writeFileSync(
        resolve(root, 'package.json'),
        JSON.stringify({ devDependencies: { oxlint: own } }),
    );
    const installed = resolve(root, 'node_modules/@jterrazz/typescript');
    mkdirSync(installed, { recursive: true });
    writeFileSync(
        resolve(installed, 'package.json'),
        JSON.stringify({ dependencies: { oxlint: toolchain } }),
    );
    return root;
}

describe('the oxlint pin — the toolchain owns it and this manifest mirrors it', () => {
    test('the declared devDependency is exactly what @jterrazz/typescript pins', () => {
        // Given - this repository as it is installed
        const declared = declaredRange(ROOT);

        // Then - the mirror is exact: the rule tests import `oxlint/plugins-dev`, and a second opinion about the toolchain's own binary is how a clone ends up with two copies
        expect(declared).toBeDefined();
        expect(declared).toBe(toolchainRange(ROOT));
    });

    test('a range that drifted from the toolchain is visible as a difference', () => {
        // Given - an install whose manifest moved on without the toolchain
        const root = installWith('^1.84.0', '^1.83.0');

        // Then - the two answers differ, which is what the test above refuses
        expect(declaredRange(root)).toBe('^1.84.0');
        expect(toolchainRange(root)).toBe('^1.83.0');
    });
});
