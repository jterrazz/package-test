import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/* Capability probes of stream capture and lifecycle, not of the fixture CLI's output (`output-asserted-as-a-golden` scalpel). */

describe('fresh-workdir', () => {
    test('fresh working dir — runs in a fresh empty temp dir when no fixture is set', async () => {
        // Given - no .fixture() — scaffold writes into the cwd
        const result = await cli.exec('scaffold');

        // Then - the scaffold output exists in the temp workdir
        expect(result.exitCode).toBe(0);
        expect(result.file('out/main.go').exists).toBe(true);
    });

    test('fresh working dir — two bare runs get independent temp dirs', async () => {
        // Given - two independent runs without a fixture
        const a = await cli.exec('scaffold');
        const b = await cli.exec('scaffold-extra');

        // Then - a does NOT see b's UNEXPECTED.txt and vice versa
        expect(a.file('out/UNEXPECTED.txt').exists).toBe(false);
        expect(b.file('out/UNEXPECTED.txt').exists).toBe(true);
    });
});
