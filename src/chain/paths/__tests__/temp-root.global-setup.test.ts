import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import setup, { TEMP_ROOTS_PARENT } from '../temp-root.global-setup.js';

describe('setup', () => {
    test("the temp-root setup — a run's scratch lives and dies in one folder — points the temp directory at a root of the run, in the one parent of roots", () => {
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

    test("the temp-root setup — a run's scratch lives and dies in one folder — names the parent of roots for the user, so a shared temp directory holds each user's apart", () => {
        // Given - the user the run is
        const uid = process.getuid?.();

        // Then - that user's parent, and no other's
        expect(TEMP_ROOTS_PARENT).toBe(`jterrazz-test-runs-${uid ?? 'user'}`);
        expect(uid).toBeDefined();
    });

    test("the temp-root setup — a run's scratch lives and dies in one folder — every project joins the one root, and the teardown of the setup that made it removes it", () => {
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
});
