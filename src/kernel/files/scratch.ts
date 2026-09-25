import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { onTestFinished, TestRunner } from 'vitest';

/**
 * A fresh, empty directory that lives as long as the test that asked for it.
 *
 * It is made under `os.tmpdir()`, which the preset points at the run's own
 * temp root, and removed once the test has finished — after its `afterEach`
 * hooks, so everything the test reads of it is read first.
 *
 * Asked for outside a running test, or inside a concurrent one, it lives until
 * the run's root is removed: vitest's global test hooks attach to whichever
 * test is current, and under `test.concurrent` that may be a sibling that ends
 * first.
 */
export function scratchDirectory(prefix: string): string {
    const directory = mkdtempSync(resolve(tmpdir(), prefix));
    const current = TestRunner.getCurrentTest();
    if (current === undefined || current.concurrent === true) {
        return directory;
    }
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    return directory;
}
