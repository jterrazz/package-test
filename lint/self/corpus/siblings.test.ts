import { spliceBetween } from '@jterrazz/typescript/rules';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { SIBLINGLESS_KINDS } from './siblingless-kinds.js';
import {
    classified,
    renderSiblings,
    siblingless,
    SIBLINGS_MARKERS,
    staleClaims,
} from './siblings.js';

const ROOT = resolve(import.meta.dirname, '../../..');

/** Meta-test `siblingless-module-declared` (`siblingless-module-declared`) — a module with behaviour and no sibling test matches no declared kind and fails here. */
describe('siblings', () => {
    test('modules with no sibling test (meta-test `siblingless-module-declared`) — reads the tree git does not ignore: a new module counts, an ignored one does not', () => {
        // Given - a checkout holding a new module and an ignored one, neither with a test
        const root = mkdtempSync(join(tmpdir(), 'siblings-'));
        mkdirSync(join(root, 'src'));
        mkdirSync(join(root, 'lint'));
        writeFileSync(join(root, 'src', 'fresh.ts'), 'export {};\n');
        writeFileSync(join(root, 'src', 'local.ts'), 'export {};\n');
        writeFileSync(join(root, 'lint', 'rule.ts'), 'export {};\n');
        writeFileSync(join(root, 'lint', 'rule.test.ts'), 'export {};\n');
        writeFileSync(join(root, '.gitignore'), 'src/local.ts\n');
        execFileSync('git', ['init', '--quiet'], { cwd: root });

        // Then - only the new one is siblingless
        expect(siblingless(root)).toStrictEqual(['src/fresh.ts']);
    });

    test('modules with no sibling test (meta-test `siblingless-module-declared`) — every one of them falls into a declared kind', () => {
        // Given - the modules with no `<file>.test.ts` beside them
        const unclaimed = classified(ROOT)
            .filter((row) => row.kind === undefined)
            .map((row) => row.path);

        // Then - each is claimed by a kind that says what proves it instead
        expect(unclaimed, 'a module with no sibling test and no declared reason').toStrictEqual([]);
    });

    test('modules with no sibling test (meta-test `siblingless-module-declared`) — a module that has its sibling test is claimed by no kind', () => {
        // Given - the modules with a `<file>.test.ts` beside them
        // Then - none is still listed as proven elsewhere
        expect(staleClaims(ROOT), 'a module with its test, still claimed').toStrictEqual([]);
    });

    test('modules with no sibling test (meta-test `siblingless-module-declared`) — no declared kind is dead', () => {
        // Given - the same modules, and the kinds that claim them
        const rows = classified(ROOT);

        // Then - a kind nobody matches is a reason for a shape that left; it goes
        expect(
            SIBLINGLESS_KINDS.filter((kind) => !rows.some((row) => row.kind === kind)).map(
                (kind) => kind.name,
            ),
        ).toStrictEqual([]);
    });

    test('modules with no sibling test (meta-test `siblingless-module-declared`) — a module no kind LISTS is unclaimed, whatever tree it is written in', () => {
        // Given - a new module in each of the trees a prefix kind used to swallow
        const newcomers = [
            'src/chain/lens.ts',
            'src/facets/api/lens.ts',
            'lint/lens.ts',
            'src/vitest/lens.ts',
            'src/services/lens.ts',
        ];

        // Then - none of them is claimed: `siblingless-module-declared` asks for the test, or for the kind
        expect(
            newcomers.filter((path) => SIBLINGLESS_KINDS.some((kind) => kind.claims(path))),
        ).toStrictEqual([]);
    });

    test('modules with no sibling test (meta-test `siblingless-module-declared`) — the table the Test page publishes is byte-identical to a fresh generation', () => {
        // Given - the kind table, which carries today's count per kind
        const chapter = readFileSync(resolve(ROOT, 'docs/guides/test.md'), 'utf8');

        // Then - regenerating reproduces it exactly (edit the source, not the projection)
        expect(
            spliceBetween(chapter, SIBLINGS_MARKERS, renderSiblings(ROOT), 'docs/guides/test.md'),
        ).toBe(chapter);
    });
});
