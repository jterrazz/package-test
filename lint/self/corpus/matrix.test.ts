import { spliceBetween } from '@jterrazz/typescript/rules';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { FACET_MATRIX_COLUMNS } from './facet-matrix.js';
import {
    capabilityFolder,
    layers,
    MATRIX_LAYERS_MARKERS,
    MATRIX_MARKERS,
    matrixCapabilityFolders,
    matrixRows,
    renderMatrixBody,
    renderMatrixLayers,
} from './matrix.js';
import { metaTests } from './meta-tests.js';

const ROOT = resolve(import.meta.dirname, '../../..');

const read = (relative: string): string => readFileSync(resolve(ROOT, relative), 'utf8');

/** Meta-test `every-capability-exercised` (`every-capability-exercised`) — a capability a facet declares with no test file exercising it fails, unless its row names the reason. */
describe('matrix', () => {
    test('capability matrix (meta-test `every-capability-exercised`) — every declared capability is exercised, or says why it is not', () => {
        // Given - the matrix derived from the declaration and the package's own trees
        const rows = matrixRows(ROOT);

        // Then - no declared cell is empty without a reason stated on its row
        const holes = rows.flatMap((row) =>
            FACET_MATRIX_COLUMNS.filter(
                (column) =>
                    row.cells[column] === 0 && row.capability.exempt?.[column] === undefined,
            ).map((column) => `${row.capability.name} · ${column}`),
        );
        expect(holes, 'a declared capability nothing exercises, and nothing excuses').toStrictEqual(
            [],
        );
    });

    test('capability matrix (meta-test `every-capability-exercised`) — a call counts where it is written in code, never where a string or a comment names it', () => {
        // Given - a cli tree whose one file names `.exec(` in a string and a comment, and another that calls it
        const root = mkdtempSync(join(tmpdir(), 'matrix-'));
        try {
            mkdirSync(join(root, 'specs/cli/exec'), { recursive: true });
            writeFileSync(join(root, 'jterrazz.config.ts'), 'export default {};\n');
            writeFileSync(
                join(root, 'specs/cli/exec/named.spec.ts'),
                "// cli.exec('x') runs the binary\nconst sentence = \"cli.exec('x')\";\n",
            );
            const named = matrixRows(root).find((row) => row.capability.name === '.exec()');
            writeFileSync(join(root, 'specs/cli/exec/called.spec.ts'), "await cli.exec('x');\n");
            const called = matrixRows(root).find((row) => row.capability.name === '.exec()');

            // Then - the file that only names it is no exercise; the file that calls it is one
            expect(named?.cells.cli).toBe(0);
            expect(called?.cells.cli).toBe(1);
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    });

    test('capability matrix (meta-test `every-capability-exercised`) — a call counts from the syntax tree, however a formatter splits it', () => {
        // Given - a cli file whose golden call the formatter broke after each paren
        const root = mkdtempSync(join(tmpdir(), 'matrix-'));
        try {
            mkdirSync(join(root, 'specs/cli/build'), { recursive: true });
            writeFileSync(join(root, 'jterrazz.config.ts'), 'export default {};\n');
            writeFileSync(
                join(root, 'specs/cli/build/tree.spec.ts'),
                "expect(result.filesystem).toMatch(\n    directory(\n        '../../_shared/_fixtures/tree/',\n    ),\n);\n",
            );
            const golden = matrixRows(root).find(
                (row) => row.capability.name === 'toMatch(directory())',
            );

            // Then - the file exercises the golden
            expect(golden?.cells.cli).toBe(1);
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    });

    test('capability matrix (meta-test `every-capability-exercised`) — a glob in a string opens no comment, and the option after it still counts', () => {
        // Given - a config whose first project collects `x/*` + `/*.yaml`, and whose component project states its clock after it
        const root = mkdtempSync(join(tmpdir(), 'matrix-'));
        try {
            writeFileSync(
                join(root, 'jterrazz.config.ts'),
                "export default { projects: [{ include: ['x/*/*.yaml'] }, component({ clock: '2026-01-02T03:04:05Z', include: ['**/*.test.tsx'] })] };\n",
            );
            const clock = matrixRows(root).find((row) => row.capability.name === 'clock');

            // Then - the clock the config states is read as written
            expect(clock?.cells.component).toBe(1);
        } finally {
            rmSync(root, { force: true, recursive: true });
        }
    });

    test('capability matrix (meta-test `every-capability-exercised`) — an exemption excuses an empty cell, and goes the day the cell fills', () => {
        // Given - every reason a capability row states, and the cell it states it for. A token row's reason is the matcher's and holds whatever a facet's goldens carry, so it is no debt to pay off
        const stale = matrixRows(ROOT)
            .filter((row) => row.capability.group !== 'Token')
            .flatMap((row) =>
                FACET_MATRIX_COLUMNS.filter(
                    (column) =>
                        row.capability.exempt?.[column] !== undefined && row.cells[column] !== 0,
                ).map((column) => `${row.capability.name} · ${column}`),
            );

        // Then - no reason outlives the hole it excused
        expect(stale, 'an exemption on a cell a spec now fills').toStrictEqual([]);
    });

    test('capability matrix (meta-test `every-capability-exercised`) — the committed projection is byte-identical to a fresh generation', () => {
        // Given - the matrix `npm run docs` splices into chapter 03
        // Then - regenerating reproduces it exactly (edit the source, not the projection)
        expect(
            spliceBetween(
                read('docs/03-testing.md'),
                MATRIX_MARKERS,
                renderMatrixBody(ROOT),
                'docs/03-testing.md',
            ),
        ).toBe(read('docs/03-testing.md'));
    });

    test('capability matrix (meta-test `every-capability-exercised`) — the layered reading is byte-identical to a fresh generation', () => {
        // Given - the layers block chapter 03 carries
        // Then - regenerating reproduces it exactly, counts included
        expect(
            spliceBetween(
                read('docs/03-testing.md'),
                MATRIX_LAYERS_MARKERS,
                renderMatrixLayers(ROOT),
                'docs/03-testing.md',
            ),
        ).toBe(read('docs/03-testing.md'));
    });

    test('capability matrix (meta-test `every-capability-exercised`) — every layer of the reading carries files', () => {
        // Given - the four layers the chapter publishes
        // Then - none of them is a claim with nothing behind it
        const found = layers(ROOT);
        expect(found).toHaveLength(5);
        for (const layer of found) {
            expect(layer.count, `${layer.layer} is empty`).toBeGreaterThan(0);
        }
    });

    test('capability matrix (meta-test `every-capability-exercised`) — the meta-test layer counts the files the meta-test channel lists under `lint/`', () => {
        // Given - the layer, and the channel's own rows outside the end-to-end suite
        const layer = layers(ROOT).find((one) => one.layer === 'Meta-tests');
        const listed = metaTests(ROOT).filter((row) => !row.file.startsWith('specs/'));

        // Then - one count for one set of files, `lint/self/` included
        expect(layer?.count).toBe(listed.length);
    });

    test.each([
        ['.seed()', 'seed'],
        ['toMatch(file())', 'to-match'],
        ['.exitCode', 'exit-code'],
        ['{{uuid}}', 'uuid'],
        ['.http exchange', 'http-exchange'],
        ['{ frozen }', 'frozen'],
        ['{ params }', 'params'],
        ['testId', 'test-id'],
    ])(
        'the capability folders — the vocabulary a spec of a specimen is filed by — the capability %s is the folder %s',
        (name, folder) => {
            // Given - a capability as the matrix names it
            const named = capabilityFolder(name);

            // Then - the words before the first parenthesis, kebab-cased
            expect(named).toBe(folder);
        },
    );

    test('the capability folders — the vocabulary a spec of a specimen is filed by — the vocabulary is the matrix, closed', () => {
        // Given - the folders the matrix names for the api column
        const folders = matrixCapabilityFolders('api');

        // Then - the capabilities are in it, a route's word and a grab-bag are not
        expect(
            ['seed', 'intercept', 'clock', 'to-match', 'params'].every((name) => folders.has(name)),
        ).toBe(true);
        expect(['users', 'label', 'assertions', 'misc'].some((name) => folders.has(name))).toBe(
            false,
        );
    });

    test("the capability folders — the vocabulary a spec of a specimen is filed by — a column's vocabulary holds only the capabilities its row declares there", () => {
        // Given - the folders of the cli and mobile columns
        const cli = matrixCapabilityFolders('cli');
        const mobile = matrixCapabilityFolders('mobile');

        // Then - `appium` and `open` are mobile's, `exec` and `fixture` cli's
        expect([
            cli.has('appium'),
            cli.has('open'),
            cli.has('exec'),
            cli.has('fixture'),
        ]).toStrictEqual([false, false, true, true]);
        expect([mobile.has('appium'), mobile.has('open'), mobile.has('exec')]).toStrictEqual([
            true,
            true,
            false,
        ]);
    });
});
