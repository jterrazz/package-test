import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { onTestFinished } from 'vitest';

/**
 * A fresh, empty directory that lives as long as the test that asked for it.
 *
 * It is made under `os.tmpdir()`, which the preset points at the run's own
 * temp root, and removed once the test has finished — after its `afterEach`
 * hooks, so everything the test reads of it is read first. Asked for outside a
 * running test, it has no test to end with and lives until the run's root is
 * removed.
 */
export function scratchDirectory(prefix: string): string {
    const directory = mkdtempSync(resolve(tmpdir(), prefix));
    try {
        onTestFinished(() => {
            rmSync(directory, { force: true, recursive: true });
        });
    } catch {
        // Outside a test: the run's temp root owns it.
    }
    return directory;
}
