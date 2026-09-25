import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { measure, readLedgers, routesLedger, writeLedger } from './ledger.js';

/** A scratch directory, removed when the test ends. */
function scratch(): string {
    const directory = mkdtempSync(join(tmpdir(), 'ledgers-'));
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    return directory;
}

describe('ledger', () => {
    test('route coverage — the ledgers — every ledger the run wrote is read back, and measured together', () => {
        // Given - two specifications' ledgers
        const directory = join(scratch(), 'routes');
        writeLedger(directory, { declared: [{ method: 'GET', path: '/a' }], reached: [] });
        writeLedger(directory, { declared: [], reached: [{ method: 'GET', path: '/a' }] });

        // Then - one measure over both
        expect(measure(readLedgers(directory))).toStrictEqual({
            declared: [{ method: 'GET', path: '/a' }],
            reached: [{ method: 'GET', path: '/a' }],
        });
    });

    test('route coverage — where a worker writes its ledger — a run whose global setup provides no ledger measures no route coverage', async () => {
        // Given - the unit project, which declares no route-coverage setup
        const ledger = await routesLedger();

        // Then - no folder to write a ledger into
        expect(ledger).toBeUndefined();
    });
});
