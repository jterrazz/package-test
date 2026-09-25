import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { frameworkTreesOf, getCallerDir, isFrameworkFrame, stackFrames } from './caller.js';

// Real directories: the check resolves real paths, and a made-up one only exercises the fallback.
const base = mkdtempSync(resolve(tmpdir(), 'caller-frames-'));

const framework = join(base, 'framework', 'dist');

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

describe('caller', () => {
    afterAll(() => {
        rmSync(base, { force: true, recursive: true });
    });

    test('stackFrames — reads both frame shapes V8 prints, a file: URL as its path, and leaves node internals and the message out', () => {
        // Given - a stack whose message mentions a location, with every frame shape
        const stack = [
            'Error: expected at /not/a/frame.ts:1:1',
            '    at Object.run (/work/specs/a.spec.ts:3:5)',
            '    at async file:///work/specs/b.spec.ts:7:9',
            '    at node:internal/process/task_queues:95:5',
            '    at new Promise (<anonymous>)',
        ].join('\n');

        // Then - the two frames of files, innermost first
        expect(stackFrames(stack)).toStrictEqual([
            { column: 5, file: '/work/specs/a.spec.ts', line: 3 },
            { column: 9, file: '/work/specs/b.spec.ts', line: 7 },
        ]);
    });

    test('caller detection — returns the directory of the calling test file', () => {
        // Given - a direct call from this sibling test file (under src/kernel/files/)
        const dir = getCallerDir();

        // Then - sibling .test.ts frames are callers, not framework internals (CONVENTIONS I2)
        expect(dir).toBe(import.meta.dirname);
    });

    test('framework frames are recognised by identity — a module inside the framework directory is a framework frame', () => {
        // Given - the framework's own bundle
        // Then - its frames are skipped when looking for the caller
        expect(isFrameworkFrame(join(framework, 'index.js'), [framework])).toBeTruthy();
    });

    test("framework frames are recognised by identity — a consumer's own src/model file is a CALLER, not an internal", () => {
        // Given - an app with its own src/model/, which the substring check (`filePath.includes('/src/model/')`) read as framework-internal
        // Then - identity says otherwise: the frame anchors fixture resolution
        expect(isFrameworkFrame(join(app, 'src', 'core', 'container.ts'), [framework])).toBeFalsy();
    });

    test("framework frames are recognised by identity — a consumer's own src/integrations and src/vitest files are callers too", () => {
        // Given - the other two layer names the old check claimed
        // Then - neither belongs to the framework
        expect(
            isFrameworkFrame(join(app, 'src', 'integrations', 'stripe.ts'), [framework]),
        ).toBeFalsy();
        expect(isFrameworkFrame(join(app, 'src', 'vitest', 'setup.ts'), [framework])).toBeFalsy();
    });

    test('framework frames are recognised by identity — a specification file is a caller', () => {
        // Given - the file that creates the runner
        // Then - it anchors fixture resolution
        expect(
            isFrameworkFrame(join(app, 'specs', 'api', 'api.specification.ts'), [framework]),
        ).toBeFalsy();
    });

    test('framework frames are recognised by identity — a sibling module test stays a caller wherever it lives (I2)', () => {
        // Given - a `<file>.test.ts` inside the framework's own directory
        writeFileSync(join(framework, 'match.test.js'), '');

        // Then - module tests are callers, so they resolve fixtures on themselves
        expect(isFrameworkFrame(join(framework, 'match.test.js'), [framework])).toBeFalsy();
    });

    test('framework frames are recognised by identity — a module of another layer is a framework frame, from the DEFAULT tree', () => {
        // Given - a sibling facet's module, judged against the tree this module derives from its own location (no explicit frameworkTree)
        const other = resolve(
            import.meta.dirname,
            '..',
            '..',
            'expectations',
            'tokens',
            'match.ts',
        );

        // Then - the whole source layer is the framework, not just this folder: A stale SOURCE_LOCATION shrinks the tree to `kernel/files/` and every other framework frame starts anchoring fixture resolution on itself
        expect(isFrameworkFrame(other)).toBeTruthy();
    });

    test('framework frames are recognised by identity — a build is its bundle and the source its maps point back to', () => {
        // Given - the framework running from a build, and from its source
        const build = join(base, 'package', 'dist');
        const source = join(base, 'package', 'src', 'kernel', 'files');

        // Then - a frame the maps rewrite to `src/` is still the framework's; from source, the source tree alone
        expect([frameworkTreesOf(build), frameworkTreesOf(source)]).toStrictEqual([
            [build, join(base, 'package', 'src')],
            [join(base, 'package', 'src')],
        ]);
    });

    test('framework frames are recognised by identity — the framework directory itself is not inside itself', () => {
        // Given - the directory, not a file within it
        // Then - the containment test is strict
        expect(isFrameworkFrame(framework, [framework])).toBeFalsy();
    });
});
