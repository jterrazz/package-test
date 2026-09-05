import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { getCallerDir, isFrameworkFrame } from './caller.js';

describe('caller detection', () => {
    test('returns the directory of the calling test file', () => {
        // Given - a direct call from this sibling test file (under src/core/)
        const dir = getCallerDir();

        // Then - sibling .test.ts frames are callers, not framework internals (CONVENTIONS I2)
        expect(dir).toBe(import.meta.dirname);
    });
});

describe('framework frames are recognised by identity', () => {
    // Real directories: the check resolves real paths, so a made-up path would
    // Only ever exercise the fallback.
    const base = mkdtempSync(resolve(tmpdir(), 'caller-frames-'));
    /** The framework as a consumer installs it: everything under one directory. */
    const framework = join(base, 'framework', 'dist');
    /** A consumer app that has its OWN src/core, src/integrations, src/vitest. */
    const app = join(base, 'app');

    for (const dir of [
        framework,
        join(app, 'src', 'core'),
        join(app, 'src', 'integrations'),
        join(app, 'src', 'vitest'),
        join(app, 'specs', 'api'),
    ]) {
        mkdirSync(dir, { recursive: true });
    }
    for (const file of [
        join(framework, 'index.js'),
        join(app, 'src', 'core', 'container.ts'),
        join(app, 'src', 'integrations', 'stripe.ts'),
        join(app, 'src', 'vitest', 'setup.ts'),
        join(app, 'src', 'core', 'container.test.ts'),
        join(app, 'specs', 'api', 'api.specification.ts'),
    ]) {
        writeFileSync(file, '');
    }

    afterAll(() => {
        rmSync(base, { force: true, recursive: true });
    });

    test('a module inside the framework directory is a framework frame', () => {
        // Given - the framework's own bundle
        // Then - its frames are skipped when looking for the caller
        expect(isFrameworkFrame(join(framework, 'index.js'), framework)).toBe(true);
    });

    test("a consumer's own src/core file is a CALLER, not an internal", () => {
        // Given - an app with its own src/core/, which the substring check
        // (`filePath.includes('/src/core/')`) read as framework-internal
        // Then - identity says otherwise: the frame anchors fixture resolution
        expect(isFrameworkFrame(join(app, 'src', 'core', 'container.ts'), framework)).toBe(false);
    });

    test("a consumer's own src/integrations and src/vitest files are callers too", () => {
        // Given - the other two layer names the old check claimed
        // Then - neither belongs to the framework
        expect(isFrameworkFrame(join(app, 'src', 'integrations', 'stripe.ts'), framework)).toBe(
            false,
        );
        expect(isFrameworkFrame(join(app, 'src', 'vitest', 'setup.ts'), framework)).toBe(false);
    });

    test('a specification file is a caller', () => {
        // Given - the file that creates the runner
        // Then - it anchors fixture resolution
        expect(isFrameworkFrame(join(app, 'specs', 'api', 'api.specification.ts'), framework)).toBe(
            false,
        );
    });

    test('a sibling module test stays a caller wherever it lives (I2)', () => {
        // Given - a `<file>.test.ts` inside the framework's own directory
        writeFileSync(join(framework, 'match.test.js'), '');

        // Then - module tests are callers, so they resolve fixtures on themselves
        expect(isFrameworkFrame(join(framework, 'match.test.js'), framework)).toBe(false);
    });

    test('the framework directory itself is not inside itself', () => {
        // Given - the directory, not a file within it
        // Then - the containment test is strict
        expect(isFrameworkFrame(framework, framework)).toBe(false);
    });
});
