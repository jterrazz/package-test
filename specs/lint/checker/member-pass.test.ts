import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

/** The fixture workspace the member pass is exercised against. */
const WORKSPACE = resolve(import.meta.dirname, '../../shared/fixtures/member-workspace');
const member = (name: string): string => `${WORKSPACE}/packages/${name}`;

describe('checker CLI — the member pass', () => {
    test('judges a member that has no specs/ root at all', async () => {
        // Given - a member with a test script, no config, and no spec tree
        const result = await cli.exec(`--member ${member('tested-no-config')} ${WORKSPACE}`);

        // Then - E3 fired: the pass is about a member, never about a tree
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('no vitest.config.ts');
    });

    test('says nothing about a member that owes nothing', async () => {
        // Given - a member with a config and only optional peers declared
        const result = await cli.exec(`--member ${member('clean')} ${WORKSPACE}`);

        // Then - one line: the project keeps no section, so nothing is held
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('jterrazz.baseline.json › test: nothing held\n');
    });

    test('`--verbose` names the member it judged and the passes that ran', async () => {
        // Given - the same clean member, judged verbosely
        const result = await cli.exec(`--member ${member('clean')} ${WORKSPACE} --verbose`);

        // Then - the member, and the passes that actually ran — from the registry itself, and never the tree ones, which walked nothing
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('packages/clean');
        expect(result.stdout.text).toContain(
            'c12-spec-file-name, c8-disk-target-exists, c25-no-ground-synonym, e3-config-present, e5b-no-simulated-dom-config-member, f8-no-seam-dependency',
        );
        expect(result.stdout.text).not.toContain('c9-dead-fixtures');
    });

    test("a root whose only tests are its members' owes no config", async () => {
        // Given - a workspace root that delegates `test` to its members
        const result = await cli.exec(`--member ${WORKSPACE} ${WORKSPACE} --verbose`);

        // Then - the root is silent, and it is named by its manifest
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('for member .');
    });

    test('a member a nested glob claims is judged like any other', async () => {
        // Given - a member the root reaches through `apps/*/packages/*`
        const result = await cli.exec(
            `--format json --member ${WORKSPACE}/apps/site/packages/nested ${WORKSPACE}`,
        );

        // Then - the retired seam gets the sentence that names its facet
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain('is a seam `@jterrazz/test` replaced');
    });

    test('--format json publishes the code the ratchet records under', async () => {
        // Given - a member declaring two dependencies the framework carries
        const result = await cli.exec(
            `--format json --member ${member('seam-dependency')} ${WORKSPACE}`,
        );

        // Then - stdout is the diagnostic array, and nothing else
        expect(result.exitCode).toBe(1);
        expect(result.json).toMatch([
            {
                code: 'jterrazz-check(f8)',
                file: 'packages/seam-dependency/package.json',
                line: 4,
                message:
                    'found: packages/seam-dependency: `@testing-library/react` is a seam `@jterrazz/test` replaced · why: A member declares no dependency `@jterrazz/test` already carries (`msw`, `vitest-mock-extended`; `yaml` in devDependencies only — as a production dependency it is the product’s own library) and no retired seam (`happy-dom`, `jsdom`, `@testing-library/*`, `@playwright/test`, `mockdate`) — except `@testing-library/react-native` where jest runs the tests of the member — the only vocabulary that runtime has until the React Native answer lands. · fix: remove `@testing-library/react` from packages/seam-dependency/package.json, and write its tests on `component()`, `website()`, `clock` or `intercept()` · read: docs/19-linting.md#f8-no-seam-dependency',
                severity: 'error',
            },
            {
                code: 'jterrazz-check(f8)',
                file: 'packages/seam-dependency/package.json',
                line: 5,
                message:
                    'found: packages/seam-dependency: `msw` is a transitive of `@jterrazz/test` · why: A member declares no dependency `@jterrazz/test` already carries (`msw`, `vitest-mock-extended`; `yaml` in devDependencies only — as a production dependency it is the product’s own library) and no retired seam (`happy-dom`, `jsdom`, `@testing-library/*`, `@playwright/test`, `mockdate`) — except `@testing-library/react-native` where jest runs the tests of the member — the only vocabulary that runtime has until the React Native answer lands. · fix: remove `msw` from packages/seam-dependency/package.json · read: docs/19-linting.md#f8-no-seam-dependency',
                severity: 'error',
            },
        ]);
    });

    test('reads the jest allowance the same from the member as from the root', async () => {
        // Given - the member whose tests an app BESIDE it runs, judged from the workspace root
        const fromRoot = await cli.exec(
            `--format json --member ${member('rn-library')} ${WORKSPACE}`,
        );

        // When - the same member is judged by the run its own gate makes, anchored at itself
        const fromMember = await cli.exec(
            `--format json --member ${member('rn-library')} ${member('rn-library')}`,
        );

        // Then - both are clean: a member-anchored run and a root-anchored one cannot disagree about one member
        expect(fromRoot.exitCode).toBe(0);
        expect(fromMember.exitCode).toBe(0);
        expect(fromMember.stdout.text.trim()).toBe(fromRoot.stdout.text.trim());
    });

    test('a member directory that does not exist is operator error', async () => {
        // Given - a typo'd member path
        const result = await cli.exec(`--member ${WORKSPACE}/packages/nope ${WORKSPACE}`);

        // Then - the run fails loudly rather than reporting a clean member
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('no such member directory');
    });
});
