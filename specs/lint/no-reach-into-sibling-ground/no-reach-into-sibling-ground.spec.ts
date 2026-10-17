import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-reach-into-sibling-ground', () => {
    test('two leaves each reading their own ground pass', async () => {
        // Given - the own-ground tree
        const result = await checker.fixture(directory('./__fixtures__/own-ground/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a seed the api folder keeps, reached from two leaves below it, passes', async () => {
        // Given - the enclosing-ground tree
        const result = await checker.fixture(directory('./__fixtures__/enclosing-ground/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a path that leaves specs/ for anything but the pool is refused where it is written', async () => {
        // Given - the leaves-specs tree
        const result = await checker.fixture(directory('./__fixtures__/leaves-specs/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/widget.test.ts:9:48  jterrazz-check(no-reach-into-sibling-ground)
                found: "../../src/x/" leaves widget
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, the specs root's included, whose \`<specs>/<role>/\` holds what the specifications share.
                fix: move what it names beside widget, or, when several leaves share it, into the ground of the lowest folder they share, which each reaches by climbing: <role>/ when they span specifications
                read: docs/reference/linting.md#no-reach-into-sibling-ground
        `);
    });

    test('the ground at the specs root is what the specifications share: a leaf reaches it by climbing, and only placement judges where it sits', async () => {
        // Given - the root-ground tree
        const result = await checker.fixture(directory('./__fixtures__/root-ground/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/__seeds__/catalog.sql:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only the leaves under api reach for, kept above them
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to api/__seeds__/catalog.sql, the ground of the lowest folder its readers share, and name it from each leaf by the path that climbs to it; \`typescript fix\` does both
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test("a document whose fixture key reaches a sibling leaf's ground is refused on that key", async () => {
        // Given - the document-reach tree
        const result = await checker.fixture(directory('./__fixtures__/document-reach/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/case.spec.yaml:2:1  jterrazz-check(no-reach-into-sibling-ground)
                found: "../gadget/__fixtures__/gadget-stub/" leaves widget
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, the specs root's included, whose \`<specs>/<role>/\` holds what the specifications share.
                fix: move what it names beside widget, or, when several leaves share it, into the ground of the lowest folder they share, which each reaches by climbing: <role>/ when they span specifications
                read: docs/reference/linting.md#no-reach-into-sibling-ground
        `);
    });

    test("a leaf reaching into a sibling leaf's ground is refused where the path is written", async () => {
        // Given - the sibling-reach tree
        const result = await checker.fixture(directory('./__fixtures__/sibling-reach/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/widget.test.ts:9:48  jterrazz-check(no-reach-into-sibling-ground)
                found: "../gadget/__fixtures__/gadget-stub/" leaves widget
                why: A path leaves its leaf only by climbing: into the ground of a folder that encloses it, the specs root's included, whose \`<specs>/<role>/\` holds what the specifications share.
                fix: move what it names beside widget, or, when several leaves share it, into the ground of the lowest folder they share, which each reaches by climbing: <role>/ when they span specifications
                read: docs/reference/linting.md#no-reach-into-sibling-ground
        `);
    });
});
