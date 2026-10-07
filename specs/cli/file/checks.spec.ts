import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/* invariant: the accessors and matchers are the subject here; the fixture CLI's output is the vehicle. */

describe('checks', () => {
    test('exists check', async () => {
        // Given - build creates files
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('build');

        // Then - file exists and absent file doesn't
        expect(result.file('dist/index.js').exists).toBe(true);
        expect(result.file('dist/nonexistent.js').exists).toBe(false);
    });

    test('content check', async () => {
        // Given - build creates files
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('build');

        // Then - file contains expected content
        expect(result.file('dist/index.js').content).toContain('Hello from CLI app');
    });

    test('chains multiple assertions on one result', async () => {
        // Given - a successful build
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('build');

        // Then - several read accessors on one result
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Build completed');
        expect(
            ['dist/index.js', 'dist/manifest.json', 'dist/index.cjs'].map(
                (path) => result.file(path).exists,
            ),
        ).toStrictEqual([true, true, false]);
        expect(result.file('dist/index.js').content).toContain('Hello from CLI app');
    });
});
