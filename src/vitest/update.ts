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
