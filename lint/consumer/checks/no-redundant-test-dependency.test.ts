import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runMember } from '../../engine/checker/member-run.js';
import { checkerMessage } from '../../engine/checker/tree-run.js';
import { CHECKER } from './checker.js';
import { CARRIED, CARRIED_IN_DEV } from './no-redundant-test-dependency.js';

const LINT_ENGINE = new Set(['@oxlint/plugins', 'oxc-parser']);

const WORKSPACE = resolve(import.meta.dirname, '../../../specs/_shared/_fixtures/member-workspace');
const memberAt = (name: string): string => resolve(WORKSPACE, 'packages', name);

function codes(dir: string, root = WORKSPACE): string[] {
    return runMember(dir, root, CHECKER).map((violation) => violation.rule);
}

describe('no-redundant-test-dependency', () => {
    test('members — members — the member pass — what a workspace member owes — a dependency the framework carries, and a seam it replaced (`no-redundant-test-dependency`)', () => {
        // Given - a member declaring msw, a testing-library package, and the optional peer a consumer declares on purpose
        const found = runMember(memberAt('seam-dependency'), WORKSPACE, CHECKER);

        // Then - the two are named, each by what it actually is, and playwright - an optional peer a consumer declares - is not
        expect(found.map((violation) => violation.rule)).toStrictEqual([
            'no-redundant-test-dependency',
            'no-redundant-test-dependency',
        ]);
        expect(found[0] === undefined ? '' : checkerMessage(CHECKER, found[0])).toContain(
            '@testing-library/react',
        );
        expect(found[0] === undefined ? '' : checkerMessage(CHECKER, found[0])).toContain(
            'is a seam `@jterrazz/test` replaced',
        );
        expect(found[1] === undefined ? '' : checkerMessage(CHECKER, found[1])).toContain(
            '`msw` is a transitive of `@jterrazz/test`',
        );
        expect(found.every((violation) => !violation.found.includes('playwright'))).toBe(true);
    });

    test('members — members — the member pass — what a workspace member owes — a finding points at the line the declaration is written on (`no-redundant-test-dependency`)', () => {
        // Given - the same member, whose manifest spells msw on its own line
        const found = runMember(memberAt('seam-dependency'), WORKSPACE, CHECKER);

        // Then - the anchor is the declaration, not the opening brace
        expect(found.map((violation) => violation.line)).toStrictEqual([4, 5]);
    });

    test("members — members — the member pass — what a workspace member owes — a runtime `yaml` is the product's, a dev one is the seam's (`no-redundant-test-dependency`)", () => {
        // Given - `clean` declares yaml as a RUNTIME dependency
        // Then - nothing fires: the framework never ships its yaml to a product
        expect(codes(memberAt('clean'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — the RN testing library stands where jest is the runner (`no-redundant-test-dependency`)', () => {
        // Given - a member whose test script is jest and whose vocabulary is the React Native one
        // Then - nothing fires: the facet that would replace it does not reach that runtime yet
        expect(codes(memberAt('rn-jest'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — the RN testing library stands where jest runs it from ONE MEMBER AWAY (`no-redundant-test-dependency`)', () => {
        // Given - a library whose own script is `vitest --run`, whose render tests are co-located in its `src/`, and an app beside it whose jest config roots into exactly that folder
        // Then - nothing fires: jest runs those tests, and where it runs them from is not the library's business
        expect(codes(memberAt('rn-library'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — the allowance reads the same from INSIDE the member as from the root (`no-redundant-test-dependency`)', () => {
        // Given - the run that member's own gate makes: anchored at the member, where the app that runs its tests is above the anchor, never below it
        const anchored = codes(memberAt('rn-library'), memberAt('rn-library'));

        // Then - the two directions agree, which is the contract the path-less run rests on
        expect(anchored).toStrictEqual([]);
        expect(anchored).toStrictEqual(codes(memberAt('rn-library')));
    });

    test('members — members — the member pass — what a workspace member owes — a jest config that reaches ANOTHER member clears nothing here (`no-redundant-test-dependency`)', () => {
        // Given - the same workspace, read from the member the playground does NOT root into
        // Then - the seam is still refused: the allowance follows the tests, not the workspace
        expect(codes(memberAt('seam-dependency'))).toStrictEqual([
            'no-redundant-test-dependency',
            'no-redundant-test-dependency',
        ]);
    });

    test('what the framework carries — the rule reads exactly the dependencies this package ships (ADR-008)', () => {
        // Given - the dependencies of the published manifest, the lint engine's own aside
        const manifest: unknown = JSON.parse(
            readFileSync(resolve(import.meta.dirname, '../../../package.json'), 'utf8'),
        );
        const dependencies: unknown =
            typeof manifest === 'object' && manifest !== null && 'dependencies' in manifest
                ? manifest.dependencies
                : undefined;
        const shipped =
            typeof dependencies === 'object' && dependencies !== null
                ? Object.keys(dependencies)
                : [];

        // Then - a seam added to or dropped from `dependencies` moves the rule with it
        expect([...CARRIED, ...CARRIED_IN_DEV].toSorted()).toStrictEqual(
            shipped.filter((name) => !LINT_ENGINE.has(name)).toSorted(),
        );
    });
});
