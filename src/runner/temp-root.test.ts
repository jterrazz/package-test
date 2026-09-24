import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import setup, { sweepOrphanRoots, TEMP_ROOTS_PARENT } from './temp-root.js';

describe("the temp-root setup — a run's scratch lives and dies in one folder", () => {
    test('points the temp directory at a root of the run, in the one parent of roots', () => {
        // Given - the run's temp directory
        const system = tmpdir();
        const prefix = join(system, TEMP_ROOTS_PARENT, `${process.pid}-`);

        // When - a project's setup runs
        const teardown = setup();
        const root = tmpdir();
        teardown();

        // Then - the root sat in the parent of roots below the directory it replaced, named by the run's pid
        expect(dirname(root)).toBe(join(system, TEMP_ROOTS_PARENT));
        expect(root.startsWith(prefix)).toBe(true);
    });

    test('every project joins the one root, and the teardown of the setup that made it removes it', () => {
        // Given - the run's temp directory, and two projects' setups
        const system = process.env.TMPDIR;
        const first = setup();
        const root = tmpdir();
        const second = setup();
        const scratch = mkdtempSync(join(tmpdir(), 'scratch-'));

        // When - the joined project tears down, then the one that made the root
        second();
        const afterJoined = existsSync(scratch);
        first();

        // Then - the scratch sat in the one root, which outlived the joined teardown only
        expect(dirname(scratch)).toBe(root);
        expect(afterJoined).toBe(true);
        expect(existsSync(root)).toBe(false);
        expect(process.env.TMPDIR).toBe(system);
    });

    test('sweeps a root whose run died, and leaves a living run its own', () => {
        // Given - a parent of roots holding the root of a dead run and the root of this one
        const parent = mkdtempSync(join(tmpdir(), 'temp-roots-'));
        onTestFinished(() => {
            rmSync(parent, { force: true, recursive: true });
        });
        const dead = join(parent, '2147483646-abc');
        const living = join(parent, `${process.pid}-abc`);
        const unrelated = join(parent, 'someone-else');
        for (const folder of [dead, living, unrelated]) {
            mkdirSync(folder);
        }

        // When - a new run sweeps that parent
        sweepOrphanRoots(parent);

        // Then - only the dead run's root is gone
        expect(existsSync(dead)).toBe(false);
        expect(existsSync(living)).toBe(true);
        expect(existsSync(unrelated)).toBe(true);
    });
});
