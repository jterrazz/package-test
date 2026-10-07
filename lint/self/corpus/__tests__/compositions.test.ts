import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { MatrixRow } from '../../../../src/chain/capability.js';
import type { Composition } from '../../../../src/chain/define-specification.js';
import { COMPOSITIONS, rowsOfCompositions } from '../compositions.js';
import { specificationMatrixMember } from '../specification-matrix.js';

const ROOT = resolve(import.meta.dirname, '../../../..');

function lineOf(row: {
    readonly group: string;
    readonly member?: string;
    readonly name: string;
    readonly probe: string;
}): string {
    return `${row.group} · ${row.name} · ${row.probe} · ${specificationMatrixMember(row)}`;
}

function actionStating(accessors: MatrixRow[]): Composition['actions'][number] {
    return {
        accessors,
        kind: 'action',
        name: 'trigger',
        perform: async () => {},
        row: { group: 'Terminal action', name: '.trigger()', probe: ".trigger('" },
    };
}

describe('compositions', () => {
    test('the specification compositions the capability matrix reads — every specification written as a composition is listed', () => {
        // Given - the `<specification>.composition.ts` files on disk, and the columns listed
        const written = readdirSync(resolve(ROOT, 'src/specifications'), { withFileTypes: true })
            .filter(
                (entry) =>
                    entry.isDirectory() &&
                    existsSync(
                        resolve(
                            ROOT,
                            'src/specifications',
                            entry.name,
                            `${entry.name}.composition.ts`,
                        ),
                    ),
            )
            .map((entry) => entry.name)
            .toSorted();

        // Then - a composition the matrix does not read would leave its specification's rows out of the table
        expect(Object.keys(COMPOSITIONS).toSorted()).toStrictEqual(written);
    });

    test('the specification compositions the capability matrix reads — every definition states the row of its own member', () => {
        // Given - each option, setup and action of every composition, with the row it states
        const strays = Object.entries(COMPOSITIONS).flatMap(([column, composition]) =>
            [
                ...Object.entries(composition.options).map(([name, row]) => ({ name, row })),
                ...composition.capabilities,
                ...composition.actions,
            ]
                .filter(({ name, row }) => specificationMatrixMember(row) !== name)
                .map(({ name, row }) => `${column} · ${name} states ${row.name}`),
        );

        // Then - the matrix names the member the chain carries, so the chain's own pin holds the row too
        expect(strays).toStrictEqual([]);
    });

    test('the specification compositions the capability matrix reads — a row two definitions state is one row', () => {
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
        expect(rowsOfCompositions(composition).map((row) => lineOf(row))).toStrictEqual([
            "Terminal action · .trigger() · .trigger(' · trigger",
            'Result accessor · .table() · result.table( · table',
        ]);
    });

    test('the specification compositions the capability matrix reads — a row stated with two probes is refused', () => {
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
        expect(() => rowsOfCompositions(composition)).toThrow(
            'the row Result accessor · .table() is stated twice, read two ways: result.table(, .table(',
        );
    });
});
