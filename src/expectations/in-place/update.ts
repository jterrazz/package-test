/** `TEST_UPDATE=1` or vitest's `-u` / `--update`. */
export function shouldUpdateSnapshots(): boolean {
    if (process.env.TEST_UPDATE === '1') {
        return true;
    }
    return process.argv.includes('-u') || process.argv.includes('--update');
}

const UPDATE_HINT = 'Run with TEST_UPDATE=1 (or vitest -u) to create it.';

// invariant: a frozen golden is never written by update mode, so its hint does not send the author to `TEST_UPDATE=1`.
const FROZEN_HINT =
    'This golden is `{ frozen }`: update mode never writes it. Write the file by hand, ' +
    'or drop `{ frozen }` for one TEST_UPDATE=1 run and put it back.';

export function missingHint(frozen: boolean): string {
    return frozen ? FROZEN_HINT : UPDATE_HINT;
}
