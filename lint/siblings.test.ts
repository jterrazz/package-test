import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { SIBLINGLESS_KINDS } from './siblingless-kinds.js';
import { classified, siblingless, spliceSiblings } from './siblings.js';

/** The repository root, from this module's place inside `lint/`. */
const ROOT = resolve(import.meta.dirname, '..');

/**
 * Meta-test K7 (`k7-siblingless-module-declared`) — no module is uncovered by
 * accident.
 *
 * I2 says a module test lives beside its module; it never said every module has
 * one, and it cannot. What it can say is that the modules WITHOUT one are known:
 * each falls into a declared kind carrying the line that says where its proof
 * is. A new module with real behaviour and no sibling test matches no kind and
 * fails here — which is the moment to write the test, not six months later when
 * a coverage number moved.
 */
describe('siblings', () => {
    test('modules with no sibling test (meta-test K7) — reads the tree git does not ignore: a new module counts, an ignored one does not', () => {
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

    test('modules with no sibling test (meta-test K7) — every one of them falls into a declared kind', () => {
        // Given - the modules with no `<file>.test.ts` beside them
        const unclaimed = classified(ROOT)
            .filter((row) => row.kind === undefined)
            .map((row) => row.path);

        // Then - each is claimed by a kind that says what proves it instead
        expect(unclaimed, 'a module with no sibling test and no declared reason').toStrictEqual([]);
    });

    test('modules with no sibling test (meta-test K7) — no declared kind is dead', () => {
        // Given - the same modules, and the kinds that claim them
        const rows = classified(ROOT);

        // Then - a kind nobody matches is a reason for a shape that left; it goes
        for (const kind of SIBLINGLESS_KINDS) {
            expect(
                rows.some((row) => row.kind === kind),
                `no module matches the kind "${kind.name}"`,
            ).toBe(true);
        }
    });

    test('modules with no sibling test (meta-test K7) — a module no kind LISTS is unclaimed, whatever tree it is written in', () => {
        // Given - a new module in each of the trees a prefix kind used to swallow
        const newcomers = [
            'src/kernel/chain/lens.ts',
            'src/facets/api/lens.ts',
            'lint/lens.ts',
            'src/vitest/lens.ts',
            'src/world/services/lens.ts',
        ];

        // Then - none of them is claimed: K7 asks for the test, or for the kind
        for (const path of newcomers) {
            expect(
                SIBLINGLESS_KINDS.some((kind) => kind.claims(path)),
                `${path} is claimed by a kind that never listed it`,
            ).toBe(false);
        }
    });

    test('modules with no sibling test (meta-test K7) — the table chapter 03 publishes is byte-identical to a fresh generation', () => {
        // Given - the kind table, which carries today's count per kind
        const chapter = readFileSync(resolve(ROOT, 'docs/03-testing.md'), 'utf8');

        // Then - regenerating reproduces it exactly (edit the source, not the projection)
        expect(spliceSiblings(chapter, ROOT)).toBe(chapter);
    });
});
