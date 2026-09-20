import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

/** The fixture workspace the member pass is exercised against. */
const WORKSPACE = resolve(import.meta.dirname, '../../_fixtures/member-workspace');
const member = (name: string): string => `${WORKSPACE}/packages/${name}`;

describe('checker CLI — the member pass', () => {
    test('judges a member that has no specs/ root at all', async () => {
        // Given - a member with a test script, no config, and no spec tree
        const result = await cli.exec(`--member ${member('tested-no-config')} ${WORKSPACE}`);

        // Then - E3 fired: the pass is about a member, never about a tree
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('no vitest.config.ts');
    });

    test('says nothing about a member that owes nothing', async () => {
        // Given - a member with a config and only optional peers declared
        const result = await cli.exec(`--member ${member('clean')} ${WORKSPACE}`);

        // Then - the run is clean, says which member it judged, and names the passes that actually ran — never the tree ones, which walked nothing
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('packages/clean');
        expect(result.stdout).toContain(
            'E3 config-present, E5b no simulated DOM, F8 no seam dependency',
        );
        expect(result.stdout).not.toContain('C9 dead fixtures');
    });

    test("a root whose only tests are its members' owes no config", async () => {
        // Given - a workspace root that delegates `test` to its members
        const result = await cli.exec(`--member ${WORKSPACE} ${WORKSPACE}`);

        // Then - the root is silent, and it is named by its manifest
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('for member .');
    });

    test('a member a nested glob claims is judged like any other', async () => {
        // Given - a member the root reaches through `apps/*/packages/*`
        const result = await cli.exec(
            `--format json --member ${WORKSPACE}/apps/site/packages/nested ${WORKSPACE}`,
        );

        // Then - the retired seam gets the sentence that names its facet
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('is a seam `@jterrazz/test` replaced');
    });

    test('--format json publishes the code the ratchet records under', async () => {
        // Given - a member declaring two dependencies the framework carries
        const result = await cli.exec(
            `--format json --member ${member('seam-dependency')} ${WORKSPACE}`,
        );

        // Then - stdout is the diagnostic array, and nothing else
        expect(result.exitCode).toBe(1);
        expect(result.json).toMatch('seam-dependency.json');
    });

    test('a member directory that does not exist is operator error', async () => {
        // Given - a typo'd member path
        const result = await cli.exec(`--member ${WORKSPACE}/packages/nope ${WORKSPACE}`);

        // Then - the run fails loudly rather than reporting a clean member
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('no such member directory');
    });
});
