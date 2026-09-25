import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { onTestFinished, TestRunner } from 'vitest';

/** Removed after the test's `afterEach`; outside a test or under `test.concurrent` it lives until the run's root is removed. */
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
