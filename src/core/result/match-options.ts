/**
 * The per-call option both `toMatch` implementations honour.
 *
 * A golden is read from disk under node and through a server command from
 * inside a page, and BOTH builds must answer `{ frozen: true }` the same way —
 * so the option is declared here, where the node matchers and the page's
 * matchers can each reach it, rather than in the runner's own folder, which a
 * seam may not import (rule I1).
 */

/**
 * Per-call options for the fixture-file `toMatch` subjects. `frozen` opts a
 * single fixture OUT of update-mode rewriting: a frozen fixture is NEVER
 * written under `TEST_UPDATE=1` (or vitest `-u`) — in update mode a frozen
 * mismatch still throws its diff, and a frozen missing fixture still throws its
 * "does not exist" error. This is what makes a DELIBERATELY-WRONG fixture (the
 * subject of a negative test that asserts the mismatch/error rendering)
 * survivable across update runs instead of being silently overwritten with the
 * actual output.
 */
export type MatchFixtureOptions = {
    frozen?: boolean;
};
