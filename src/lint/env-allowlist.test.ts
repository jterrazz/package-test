import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { findEnvOffenders, findUnsanctionedDynamicReads, sourceFiles } from './env-allowlist.js';

/**
 * CONVENTIONS E1 (meta-test) — the framework reads only its own generic-prefixed
 * env vars. Any `process.env.<NAME>` read in non-test `src/` must be in the
 * allowlist; a dynamic read (`process.env[expr]`) must carry an `env-sanction`
 * comment. New env coupling cannot slip in unnoticed.
 */
const files = sourceFiles(resolve(import.meta.dirname, '..'));

/**
 * A scanner-input fixture (a `.txt`, so it never enters {@link sourceFiles} nor
 * the real sweep) carrying the three offences the scanner must catch: an
 * out-of-allowlist dot read, an out-of-allowlist string-bracket read, and an
 * unsanctioned dynamic read — plus one `env-sanction`ed dynamic read it spares.
 */
const OFFENDER_FIXTURE = resolve(import.meta.dirname, 'env-allowlist.offenders.txt');

describe('framework env reads — E1 allowlist (meta-test)', () => {
    test('every static env read is in the allowlist', () => {
        // Given - all static process.env.<NAME> reads across non-test src/
        // Then - none outside the allowlist
        expect(findEnvOffenders(files)).toEqual([]);
    });

    test('every dynamic env read carries an env-sanction comment', () => {
        // Given - dynamic process.env[expr] reads
        // Then - each is explicitly sanctioned
        expect(findUnsanctionedDynamicReads(files)).toEqual([]);
    });

    test('the scanner reports out-of-allowlist static reads (positive coverage)', () => {
        // Given - a fixture with a dot read and a string-bracket read, both unlisted
        const offenders = findEnvOffenders([OFFENDER_FIXTURE]);

        // Then - both are surfaced (proving the sweep is not vacuously green)
        expect(offenders).toEqual([
            `${OFFENDER_FIXTURE}: process.env.SECRET`,
            `${OFFENDER_FIXTURE}: process.env.OTHER_SECRET`,
        ]);
    });

    test('the scanner reports an unsanctioned dynamic read but spares a sanctioned one', () => {
        // Given - a fixture with one bare dynamic read and one env-sanctioned read
        const dynamic = findUnsanctionedDynamicReads([OFFENDER_FIXTURE]);

        // Then - only the unsanctioned read (line 3) is flagged
        expect(dynamic).toEqual([`${OFFENDER_FIXTURE}:3`]);
    });
});
