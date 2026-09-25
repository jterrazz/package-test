import type { Composition } from '../../src/facets/define-facet.js';
import { jobsFacet } from '../../src/facets/jobs/jobs.facet.js';
import type { Column } from '../facet-matrix.js';

/** A row a definition states about itself. */
type MatrixRow = Composition['options'][string];

/**
 * The facets that are a composition, by matrix column — what the capability
 * matrix reads a facet's rows from. A self module: it imports the facets
 * themselves, so only the package's own tooling (the matrix, C35, the
 * meta-tests) loads it, never what a consumer installs.
 *
 * A facet column listed here states its rows through its composition; one
 * absent still reads them from the hand rows of `facet-matrix.ts`.
 */
export const COMPOSITIONS: Partial<Record<Exclude<Column, 'module'>, Composition>> = {
    jobs: jobsFacet.composition,
};

/** Is the column a facet listed as a composition? */
export function isComposed(column: Column): boolean {
    return column !== 'module' && COMPOSITIONS[column] !== undefined;
}

/**
 * The rows an action states beyond its own and its result's: the options it
 * takes beside its arguments, and — for an action that drives a scenario — the
 * verbs and descriptors its visitor hands out.
 */
type StatedRows = {
    readonly descriptors?: readonly MatrixRow[];
    readonly options?: readonly { readonly row: MatrixRow }[];
    readonly verbs?: readonly MatrixRow[];
};

/** Every row one action states: itself, its options, its visitor, its result. */
function actionRows(action: Composition['actions'][number] & StatedRows): MatrixRow[] {
    return [
        action.row,
        ...(action.options ?? []).map((option) => option.row),
        ...(action.verbs ?? []),
        ...(action.descriptors ?? []),
        ...action.accessors,
    ];
}

/** Where a row sits in the matrix: its group and its name. */
function keyOf(row: MatrixRow): string {
    return `${row.group} · ${row.name}`;
}

/**
 * Every matrix row a composition states, each once: its constructor's
 * options, its setups, its actions with what each takes and hands back. Two
 * definitions stating one row (two actions whose results share an accessor)
 * state it once; stating it with two probes is refused, since a row counts by
 * one probe.
 */
export function composedRows(composition: Composition): MatrixRow[] {
    const rows = new Map<string, MatrixRow>();
    for (const row of [
        ...Object.values(composition.options),
        ...composition.capabilities.map((capability) => capability.row),
        ...composition.actions.flatMap((action) => actionRows(action)),
    ]) {
        const seen = rows.get(keyOf(row));
        if (seen !== undefined && (seen.probe !== row.probe || seen.member !== row.member)) {
            throw new Error(
                `the row ${keyOf(row)} is stated twice, read two ways: ${seen.probe}, ${row.probe}`,
            );
        }
        rows.set(keyOf(row), row);
    }
    return [...rows.values()];
}
