import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { MatrixRow } from '../../../src/kernel/chain/capability.js';
import type { Composition } from '../../../src/kernel/chain/define-facet.js';
import { composedRows, COMPOSITIONS } from './compositions.js';
import { memberOf } from './facet-matrix.js';

const ROOT = resolve(import.meta.dirname, '../../..');

function lineOf(row: {
    readonly group: string;
    readonly member?: string;
    readonly name: string;
    readonly probe: string;
}): string {
    return `${row.group} · ${row.name} · ${row.probe} · ${memberOf(row)}`;
}

function actionStating(accessors: MatrixRow[]): Composition['actions'][number] {
    return {
        accessors,
        kind: 'action',
        name: 'trigger',
        perform: async () => {
            await Promise.resolve();
        },
        row: { group: 'Terminal action', name: '.trigger()', probe: ".trigger('" },
    };
}

describe('compositions', () => {
    test('the facet compositions the capability matrix reads — every facet written as a composition is listed', () => {
        // Given - the `<facet>.facet.ts` files on disk, and the columns listed
        const written = readdirSync(resolve(ROOT, 'src/facets'), { withFileTypes: true })
            .filter(
                (entry) =>
                    entry.isDirectory() &&
                    existsSync(resolve(ROOT, 'src/facets', entry.name, `${entry.name}.facet.ts`)),
            )
            .map((entry) => entry.name)
            .toSorted();

        // Then - a composition the matrix does not read would leave its facet's rows out of the table
        expect(Object.keys(COMPOSITIONS).toSorted()).toStrictEqual(written);
    });

    test('the facet compositions the capability matrix reads — every definition states the row of its own member', () => {
        // Given - each option, setup and action of every composition, with the row it states
        const strays = Object.entries(COMPOSITIONS).flatMap(([column, composition]) =>
            [
                ...Object.entries(composition.options).map(([name, row]) => ({ name, row })),
                ...composition.capabilities,
                ...composition.actions,
            ]
                .filter(({ name, row }) => memberOf(row) !== name)
                .map(({ name, row }) => `${column} · ${name} states ${row.name}`),
        );

        // Then - the matrix names the member the chain carries, so the chain's own pin holds the row too
        expect(strays).toStrictEqual([]);
    });

    test('the facet compositions the capability matrix reads — a row two definitions state is one row', () => {
        // Given - two actions whose results both answer `.table()`
        const table: MatrixRow = {
            group: 'Result accessor',
            member: 'table',
            name: '.table()',
            probe: 'result.table(',
        };
        const composition: Composition = {
            actions: [actionStating([table]), actionStating([table])],
            capabilities: [],
            options: {},
        };

        // Then - the matrix reads it once
        expect(composedRows(composition).map((row) => lineOf(row))).toStrictEqual([
            "Terminal action · .trigger() · .trigger(' · trigger",
            'Result accessor · .table() · result.table( · table',
        ]);
    });

    test('the facet compositions the capability matrix reads — a row stated with two probes is refused', () => {
        // Given - two actions answering `.table()`, each read by its own probe
        const composition: Composition = {
            actions: [
                actionStating([
                    {
                        group: 'Result accessor',
                        member: 'table',
                        name: '.table()',
                        probe: 'result.table(',
                    },
                ]),
                actionStating([
                    {
                        group: 'Result accessor',
                        member: 'table',
                        name: '.table()',
                        probe: '.table(',
                    },
                ]),
            ],
            capabilities: [],
            options: {},
        };

        // Then - a row counts by one probe, so the second reading is named
        expect(() => composedRows(composition)).toThrow(
            'the row Result accessor · .table() is stated twice, read two ways: result.table(, .table(',
        );
    });
});
