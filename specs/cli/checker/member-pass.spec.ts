import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../checker-cli.specification.js';

const WORKSPACE = resolve(import.meta.dirname, '../../__fixtures__/member-workspace');
const member = (name: string): string => `${WORKSPACE}/packages/${name}`;

describe('member-pass', () => {
    test('checker CLI — the member pass — judges a member that has no specs/ root at all', async () => {
        // Given - a member declaring a dependency the framework carries, and no spec tree
        const result = await cli.exec(`--member ${member('seam-dependency')} ${WORKSPACE}`);

        // Then - `no-redundant-test-dependency` fired: the pass is about a member, never about a tree
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain('no-redundant-test-dependency');
    });

    test('checker CLI — the member pass — says nothing about a member that owes nothing', async () => {
        // Given - a member with a config and only optional peers declared
        const result = await cli.exec(`--member ${member('clean')} ${WORKSPACE}`);

        // Then - one line: the project keeps no section, so nothing is held
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('.jterrazz/baseline.json › test: nothing held\n');
    });

    test('checker CLI — the member pass — `--verbose` names the member it judged and the passes that ran', async () => {
        // Given - the same clean member, which keeps a specs tree under web/, judged verbosely under a root that lists no preset
        const result = await cli.exec(`--member ${member('clean')} ${WORKSPACE} --verbose`);

        // Then - the member, and the passes that actually ran: its own tree's, then the member's
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain(
            'conventions checker for member packages/clean (reserved-folder-in-closed-list, ',
        );
        expect(result.stdout.text).toContain(
            'no-snapshot-folder, no-simulated-dom-in-config, no-redundant-test-dependency)',
        );
    });

    test('checker CLI — the member pass — runs no tree pass for a member that keeps no specs tree', async () => {
        // Given - a member with no spec tree, judged verbosely
        const result = await cli.exec(
            `--member ${member('seam-dependency')} ${WORKSPACE} --verbose`,
        );

        // Then - only the member passes are named
        expect(result.stdout.text).toContain(
            'conventions checker for member packages/seam-dependency (file-suffix-matches-place, named-path-exists, no-snapshot-folder, no-simulated-dom-in-config, no-redundant-test-dependency)',
        );
    });

    test("checker CLI — the member pass — a root whose only tests are its members' owes no config", async () => {
        // Given - a workspace root that delegates `test` to its members
        const result = await cli.exec(`--member ${WORKSPACE} ${WORKSPACE} --verbose`);

        // Then - the root is silent, and it is named by its manifest
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('for member .');
    });

    test('checker CLI — the member pass — a member a nested glob claims is judged like any other', async () => {
        // Given - a member the root reaches through `apps/*/packages/*`
        const result = await cli.exec(
            `--format json --member ${WORKSPACE}/apps/site/packages/nested ${WORKSPACE}`,
        );

        // Then - the retired seam gets the sentence that names its specification
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain('is a seam `@jterrazz/test` replaced');
    });

    test('checker CLI — the member pass — --format json publishes the code the ratchet records under', async () => {
        // Given - a member declaring two dependencies the framework carries
        const result = await cli.exec(
            `--format json --member ${member('seam-dependency')} ${WORKSPACE}`,
        );

        // Then - stdout is the diagnostic array, and nothing else
        expect(result.exitCode).toBe(1);
        expect(result.json).toMatch([
            {
                column: 1,
                line: 4,
                message:
                    "found: packages/seam-dependency: `@testing-library/react` is a seam `@jterrazz/test` replaced · why: A member declares no dependency `@jterrazz/test` already carries (`msw`, `vitest-mock-extended`; `yaml` in devDependencies only, as a production dependency it is the product's own library) and no retired seam (`happy-dom`, `jsdom`, `@testing-library/*`, `@playwright/test`, `mockdate`), except `@testing-library/react-native` where jest runs the tests of the member: the only vocabulary that runtime has until the React Native answer lands. · fix: remove `@testing-library/react` from packages/seam-dependency/package.json, and write its tests on `component()`, `website()`, `clock` or `intercept()` · read: docs/reference/linting.md#no-redundant-test-dependency",
                path: 'packages/seam-dependency/package.json',
                rule: 'jterrazz-check/no-redundant-test-dependency',
            },
            {
                column: 1,
                line: 5,
                message:
                    "found: packages/seam-dependency: `msw` is a transitive of `@jterrazz/test` · why: A member declares no dependency `@jterrazz/test` already carries (`msw`, `vitest-mock-extended`; `yaml` in devDependencies only, as a production dependency it is the product's own library) and no retired seam (`happy-dom`, `jsdom`, `@testing-library/*`, `@playwright/test`, `mockdate`), except `@testing-library/react-native` where jest runs the tests of the member: the only vocabulary that runtime has until the React Native answer lands. · fix: remove `msw` from packages/seam-dependency/package.json · read: docs/reference/linting.md#no-redundant-test-dependency",
                path: 'packages/seam-dependency/package.json',
                rule: 'jterrazz-check/no-redundant-test-dependency',
            },
        ]);
    });

    test('checker CLI — the member pass — reads the jest allowance the same from the member as from the root', async () => {
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

    test('checker CLI — the member pass — a member directory that does not exist is operator error', async () => {
        // Given - a typo'd member path
        const result = await cli.exec(`--member ${WORKSPACE}/packages/nope ${WORKSPACE}`);

        // Then - the run fails loudly rather than reporting a clean member
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain('no such member directory');
    });

    test("checker CLI — the member pass — judges the member's own specs trees where the root lists no preset", async () => {
        // Given - a workspace whose root declares nothing, and a member whose spec reads a short golden alone
        const trees = resolve(import.meta.dirname, '__fixtures__/member-trees');
        const result = await cli.exec(`--member ${trees}/packages/site ${trees}`);

        // Then - the tree pass ran for the member: the golden is refused where the test names it
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain(
            'packages/site/specs/widget/widget.test.ts:6:33: error jterrazz-check(ground-shared-or-inline): found: widget/__expected__/ready.txt, read by this test alone · why: A ground file exists only if it is shared, and a value lives in a test only while it stays short. · fix: write it here, the value `toMatch` compares, and delete the file; `typescript fix` inlines it · read: docs/reference/linting.md#ground-shared-or-inline',
        );
    });
});
