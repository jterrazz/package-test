import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('manifest', () => {
    test('keeps the workspace private', () => {
        // Given - the root manifest
        const manifest: unknown = JSON.parse(readFileSync('../package.json', 'utf8'));

        // Then - it is never published
        expect(manifest).toMatchObject({ private: true });
    });
});
