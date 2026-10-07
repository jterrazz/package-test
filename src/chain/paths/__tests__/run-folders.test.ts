import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { sweepFinishedEvidence, sweepOrphanRoots } from '../run-folders.js';

// invariant: a run that cannot be alive: above the pid range of every system the suite runs on.
const DEAD = '2147483646';

function folderHolding(entries: readonly string[]): string {
    const folder = mkdtempSync(join(tmpdir(), 'run-folders-'));
    onTestFinished(() => {
        rmSync(folder, { force: true, recursive: true });
    });
    for (const entry of entries) {
        mkdirSync(join(folder, entry));
    }
    return folder;
}

describe('run-folders', () => {
    test("the run folders — a finished run's folder is swept, a living one's kept — sweeps the root of a dead run, and keeps a living run's and every name no run gave", () => {
        // Given - a parent of roots holding a dead run's root, this run's, and names no run gave
        const folder = folderHolding([
            `${DEAD}-abc`,
            `${process.pid}-abc`,
            'someone-else',
            '0-abc',
            '1.5-abc',
        ]);

        // When - a new run sweeps that parent
        sweepOrphanRoots(folder);

        // Then - only the dead run's root is gone
        expect(readdirSync(folder).toSorted()).toStrictEqual(
            ['0-abc', '1.5-abc', `${process.pid}-abc`, 'someone-else'].toSorted(),
        );
    });

    test("the run folders — a finished run's folder is swept, a living one's kept — sweeps every evidence folder but a living run's, so evidence never outgrows the runs still going and the last one that ended", () => {
        // Given - an evidence folder holding a dead run's, this run's, one of a process another user owns, and names no run gave
        const folder = folderHolding([
            `${DEAD}-abc`,
            `${process.pid}-abc`,
            '1-abc',
            'website-abc',
            '0-abc',
        ]);

        // When - a new run sweeps it
        sweepFinishedEvidence(folder);

        // Then - only the living runs' evidence stays
        expect(readdirSync(folder).toSorted()).toStrictEqual(
            ['1-abc', `${process.pid}-abc`].toSorted(),
        );
    });

    test("the run folders — a finished run's folder is swept, a living one's kept — a project with no evidence folder yet has nothing to sweep, and none is made", () => {
        // Given - an evidence folder that does not exist
        const folder = join(folderHolding([]), 'evidence');

        // When - a new run sweeps it
        sweepFinishedEvidence(folder);

        // Then - it still does not exist
        expect(existsSync(folder)).toBe(false);
    });
});
