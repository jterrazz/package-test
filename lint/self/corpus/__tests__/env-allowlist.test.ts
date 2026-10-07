import { originalOf } from '@jterrazz/typescript/rules';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { findEnvOffenders, findUnsanctionedDynamicReads, sourceFiles } from '../env-allowlist.js';

/** rule `environment-read-allow-listed` (meta-test) — the framework reads only its own generic-prefixed env vars. */
const files = sourceFiles(originalOf(resolve(import.meta.dirname, '../../../../src')));

/** A `.txt`, so it never enters the real sweep. */
const OFFENDER_FIXTURE = resolve(import.meta.dirname, 'env-allowlist.offenders.txt');

describe('env-allowlist', () => {
    test('framework env reads — environment-read-allow-listed (meta-test) — every static env read is in the allowlist', () => {
        // Given - all static process.env.<NAME> reads across non-test src/
        // Then - none outside the allowlist
        expect(findEnvOffenders(files)).toStrictEqual([]);
    });

    test('framework env reads — environment-read-allow-listed (meta-test) — every dynamic env read carries an env-sanction comment', () => {
        // Given - dynamic process.env[expr] reads
        // Then - each is explicitly sanctioned
        expect(findUnsanctionedDynamicReads(files)).toStrictEqual([]);
    });

    test('framework env reads — environment-read-allow-listed (meta-test) — the scanner reports out-of-allowlist static reads (positive coverage)', () => {
        // Given - a fixture with a dot read and a string-bracket read, both unlisted
        const offenders = findEnvOffenders([OFFENDER_FIXTURE]);

        // Then - both are surfaced (proving the sweep is not vacuously green)
        expect(offenders).toStrictEqual([
            `${OFFENDER_FIXTURE}: process.env.SECRET`,
            `${OFFENDER_FIXTURE}: process.env.OTHER_SECRET`,
        ]);
    });

    test('framework env reads — environment-read-allow-listed (meta-test) — the scanner reports an unsanctioned dynamic read but spares a sanctioned one', () => {
        // Given - a fixture with one bare dynamic read and one env-sanctioned read
        const dynamic = findUnsanctionedDynamicReads([OFFENDER_FIXTURE]);

        // Then - only the unsanctioned read (line 3) is flagged
        expect(dynamic).toStrictEqual([`${OFFENDER_FIXTURE}:3`]);
    });
});
