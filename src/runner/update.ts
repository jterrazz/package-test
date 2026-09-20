/**
 * Snapshot update-mode detection. `TEST_UPDATE=1` (framework convention, see
 * CONVENTIONS E1) or vitest's `-u` / `--update` flag turn fixture mismatches
 * into fixture rewrites.
 */
export function shouldUpdateSnapshots(): boolean {
    if (process.env.TEST_UPDATE === '1') {
        return true;
    }
    return process.argv.includes('-u') || process.argv.includes('--update');
}

/** Standard hint appended to missing-fixture errors. */
export const UPDATE_HINT = 'Run with TEST_UPDATE=1 (or vitest -u) to create it.';

/**
 * The hint a FROZEN golden gets instead. `{ frozen }` is the switch that tells
 * update mode to leave this file alone, so sending its author to `TEST_UPDATE=1`
 * would send them to a run that does nothing.
 */
export const FROZEN_HINT =
    'This golden is `{ frozen }`: update mode never writes it. Write the file by hand, ' +
    'or drop `{ frozen }` for one TEST_UPDATE=1 run and put it back.';

/** The hint a missing golden earns, given whether it is frozen. */
export function missingHint(frozen: boolean): string {
    return frozen ? FROZEN_HINT : UPDATE_HINT;
}
