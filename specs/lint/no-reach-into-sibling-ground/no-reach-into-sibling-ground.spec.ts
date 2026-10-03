import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-reach-into-sibling-ground', () => {
    test('two leaves each reading their own ground pass', async () => {
        // Given - the own-ground tree
        const result = await checker.fixture(directory('./_fixtures/own-ground/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a seed the api folder keeps, reached from two leaves below it, passes', async () => {
        // Given - the enclosing-ground tree
        const result = await checker.fixture(directory('./_fixtures/enclosing-ground/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('--fix moves a root role folder under _shared/, on to the facet that reads it, and every path to it', async () => {
        // Given - the root-ground tree
        const result = await checker
            .fixture(directory('./_fixtures/root-ground/'))
            .run({ fix: true });

        // Then - nothing is left to report, and the fixed tree is its golden
        expect(result.report).toMatch('');
        await expect(result.directory('specs/api')).toMatch(
            directory('./_expected/root-ground/api/'),
        );
        await expect(result.directory('specs/_shared')).toMatch(
            directory('./_expected/root-ground/shared/'),
        );
        await expect(result.directory('src')).toMatch(directory('./_expected/root-ground/src/'));
        expect(result.file('specs/tool/widget/renders.spec.yaml').content).toContain(
            'fixture: ../../_shared/_fixtures/stub/',
        );
    });

    test('a path that leaves specs/ for anything but the pool is refused where it is written', async () => {
        // Given - the leaves-specs tree
        const result = await checker.fixture(directory('./_fixtures/leaves-specs/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/widget.test.ts:9:48  jterrazz-check(no-reach-into-sibling-ground)
                found: "../../src/x/" leaves widget
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, or into the specs root's shared ground, \`<specs>/_shared/<role>/\`.
                fix: move what it names beside widget, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: _shared/<role>/ when they span facets
                read: docs/24-linting.md#no-reach-into-sibling-ground
        `);
    });

    test('a role folder at the specs root is refused as a folder and at every path into it', async () => {
        // Given - the root-ground tree
        const result = await checker.fixture(directory('./_fixtures/root-ground/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/_fixtures:1:1  jterrazz-check(no-reach-into-sibling-ground)
                found: _fixtures/ at the specs root, shared ground outside _shared/
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, or into the specs root's shared ground, \`<specs>/_shared/<role>/\`.
                fix: move it to _shared/_fixtures/ — \`typescript fix\` moves it and rewrites every whole relative path that names it
                read: docs/24-linting.md#no-reach-into-sibling-ground
            specs/_seeds:1:1  jterrazz-check(no-reach-into-sibling-ground)
                found: _seeds/ at the specs root, shared ground outside _shared/
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, or into the specs root's shared ground, \`<specs>/_shared/<role>/\`.
                fix: move it to _shared/_seeds/ — \`typescript fix\` moves it and rewrites every whole relative path that names it
                read: docs/24-linting.md#no-reach-into-sibling-ground
            specs/api/orders/listed-over-the-catalog.spec.ts:10:20  jterrazz-check(no-reach-into-sibling-ground)
                found: "../../_seeds/catalog.sql" leaves api/orders
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, or into the specs root's shared ground, \`<specs>/_shared/<role>/\`.
                fix: move what it names beside api/orders, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: _shared/<role>/ when they span facets
                read: docs/24-linting.md#no-reach-into-sibling-ground
            specs/api/users/users.spec.ts:9:40  jterrazz-check(no-reach-into-sibling-ground)
                found: "../../_seeds/catalog.sql" leaves api/users
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, or into the specs root's shared ground, \`<specs>/_shared/<role>/\`.
                fix: move what it names beside api/users, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: _shared/<role>/ when they span facets
                read: docs/24-linting.md#no-reach-into-sibling-ground
            specs/tool/gadget/renders.spec.yaml:2:1  jterrazz-check(no-reach-into-sibling-ground)
                found: "../../_fixtures/stub/" leaves tool/gadget
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, or into the specs root's shared ground, \`<specs>/_shared/<role>/\`.
                fix: move what it names beside tool/gadget, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: _shared/<role>/ when they span facets
                read: docs/24-linting.md#no-reach-into-sibling-ground
            specs/tool/widget/renders.spec.yaml:2:1  jterrazz-check(no-reach-into-sibling-ground)
                found: "../../_fixtures/stub/" leaves tool/widget
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, or into the specs root's shared ground, \`<specs>/_shared/<role>/\`.
                fix: move what it names beside tool/widget, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: _shared/<role>/ when they span facets
                read: docs/24-linting.md#no-reach-into-sibling-ground
        `);
    });

    test("a document whose fixture key reaches a sibling leaf's ground is refused on that key", async () => {
        // Given - the document-reach tree
        const result = await checker.fixture(directory('./_fixtures/document-reach/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/case.spec.yaml:2:1  jterrazz-check(no-reach-into-sibling-ground)
                found: "../gadget/_fixtures/gadget-stub/" leaves widget
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, or into the specs root's shared ground, \`<specs>/_shared/<role>/\`.
                fix: move what it names beside widget, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: _shared/<role>/ when they span facets
                read: docs/24-linting.md#no-reach-into-sibling-ground
        `);
    });

    test("a leaf reaching into a sibling leaf's ground is refused where the path is written", async () => {
        // Given - the sibling-reach tree
        const result = await checker.fixture(directory('./_fixtures/sibling-reach/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/widget.test.ts:9:48  jterrazz-check(no-reach-into-sibling-ground)
                found: "../gadget/_fixtures/gadget-stub/" leaves widget
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, or into the specs root's shared ground, \`<specs>/_shared/<role>/\`.
                fix: move what it names beside widget, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: _shared/<role>/ when they span facets
                read: docs/24-linting.md#no-reach-into-sibling-ground
        `);
    });
});
