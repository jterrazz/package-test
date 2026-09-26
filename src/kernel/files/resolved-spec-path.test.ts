import { describe, expect, test } from 'vitest';

import { resolveSpecPath } from './resolved-spec-path.js';

describe('resolveSpecPath', () => {
    test('spec path resolution — a relative path resolves from the spec directory, climbing included', () => {
        // Given - a spec two levels under specs/, naming its own ground and the pool
        const specDir = '/repo/specs/cli/build';

        // Then - both resolve from the spec, never from the working directory
        expect(resolveSpecPath('seed', './seeds/users.sql', specDir)).toBe(
            '/repo/specs/cli/build/seeds/users.sql',
        );
        expect(resolveSpecPath('fixture', '../../fixtures/shop/', specDir)).toBe(
            '/repo/specs/fixtures/shop',
        );
    });

    test('spec path resolution — a bare name is refused before anything is read', () => {
        // Given - a bare name, resolved against no folder the call shows
        // Then - refused with the verb
        expect(() => resolveSpecPath('request', 'create.http', '/repo/specs')).toThrow(
            /^found: request\("create\.http"\), a path that is not relative to the spec file/u,
        );
    });
});
