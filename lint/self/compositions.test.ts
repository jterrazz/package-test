import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { Composition } from '../../src/facets/define-facet.js';
import type { MatrixRow } from '../../src/model/chain/capability.js';
import { CAPABILITIES, COLUMNS, memberOf } from '../facet-matrix.js';
import { composedRows, COMPOSITIONS, isComposed } from './compositions.js';

/** The repository root, from this module's place inside `lint/self/`. */
const ROOT = resolve(import.meta.dirname, '../..');

/** A row as one line: where it sits, how it is read, the member it answers for. */
function lineOf(row: {
    readonly group: string;
    readonly member?: string;
    readonly name: string;
    readonly probe: string;
}): string {
    return `${row.group} · ${row.name} · ${row.probe} · ${memberOf(row)}`;
}

/** The groups a facet states about itself. */
const FACET_GROUPS = new Set<string>([
    'Constructor option',
    'Descriptor',
    'Result accessor',
    'Route option',
    'Setup',
    'Terminal action',
    'Verb',
]);

/** The composed columns, each with its composition. */
function composed(): [string, Composition][] {
    const found: [string, Composition][] = [];
    for (const column of COLUMNS) {
        const composition = column === 'module' ? undefined : COMPOSITIONS[column];
        if (composition !== undefined) {
            found.push([column, composition]);
        }
    }
    return found;
}

/** A terminal action stating the given accessors, for a composition built in a test. */
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

describe('the facet compositions the capability matrix reads', () => {
    test('a composed column states exactly the rows its hand rows declared', () => {
        // Given - every column listed as a composition, and the hand rows kept until every facet is one
        const differences = composed().flatMap(([column, composition]) => {
            const hand = CAPABILITIES.filter(
                (capability) =>
                    FACET_GROUPS.has(capability.group) &&
                    capability.columns.some((declared) => declared === column),
            )
                .map((capability) => lineOf(capability))
                .toSorted();
            const stated = composedRows(composition)
                .map((row) => lineOf(row))
                .toSorted();
            const added = stated.filter((line) => !hand.includes(line));
            const dropped = hand.filter((line) => !stated.includes(line));
            return added
                .map((line) => `${column} + ${line}`)
                .concat(dropped.map((line) => `${column} - ${line}`));
        });

        // Then - the composition and the hand rows it replaces name the same rows, read the same way
        expect(differences).toStrictEqual([]);
    });

    test('every facet written as a composition is listed', () => {
        // Given - the `<facet>.facet.ts` files on disk, and the columns listed
        const written = readdirSync(resolve(ROOT, 'src/facets'), { withFileTypes: true })
            .filter(
                (entry) =>
                    entry.isDirectory() &&
                    existsSync(resolve(ROOT, 'src/facets', entry.name, `${entry.name}.facet.ts`)),
            )
            .map((entry) => entry.name)
            .toSorted();

        // Then - a composition the matrix does not read would leave its column on the hand rows
        expect(COLUMNS.filter((column) => isComposed(column)).toSorted()).toStrictEqual(written);
    });

    test('every definition states the row of its own member', () => {
        // Given - each option, setup and action of every composition, with the row it states
        const strays = composed().flatMap(([column, composition]) =>
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

    test('a row two definitions state is one row', () => {
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

    test('a row stated with two probes is refused', () => {
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
