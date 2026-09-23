import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * These are exec()-capability probes: the subject under test is stream capture,
 * routing and lifecycle (stdout/stderr, exit codes, waitFor, process-group kill),
 * not the fixture CLI's output correctness. Targeted toContain probes are the right
 * level; the waitFor block is cut at an arbitrary instant (CONVENTIONS D11(b)), unstable
 * to snapshot by nature. Whole-output correctness IS a golden — see help.txt/start.txt.
 */

describe('exec', () => {
    test('fresh working dir — runs in a fresh empty temp dir when no fixture is set', async () => {
        // Given - no .fixture() — scaffold writes into the cwd
        const result = await cli.exec('scaffold');

        // Then - the scaffold output exists in the temp workdir
        expect(result.exitCode).toBe(0);
        expect(result.file('out/main.go').exists).toBeTruthy();
    });

    test('fresh working dir — two bare runs get independent temp dirs', async () => {
        // Given - two independent runs without a fixture
        const a = await cli.exec('scaffold');
        // checker-disable-next-line c29 -- two runs are the behaviour under test: each gets a working directory of its own
        const b = await cli.exec('scaffold-extra');

        // Then - a does NOT see b's UNEXPECTED.txt and vice versa
        expect(a.file('out/UNEXPECTED.txt').exists).toBeFalsy();
        expect(b.file('out/UNEXPECTED.txt').exists).toBeTruthy();
    });
});
