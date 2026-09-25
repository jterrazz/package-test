import { apiFacet } from '../../src/facets/api/api.facet.js';
import { cliFacet } from '../../src/facets/cli/cli.facet.js';
import { componentFacet } from '../../src/facets/component/component.facet.js';
import type { Composition } from '../../src/facets/define-facet.js';
import { integrationFacet } from '../../src/facets/integration/integration.facet.js';
import { jobsFacet } from '../../src/facets/jobs/jobs.facet.js';
import { mobileFacet } from '../../src/facets/mobile/mobile.facet.js';
import { websiteFacet } from '../../src/facets/website/website.facet.js';
import type { Column } from '../facet-matrix.js';

/** A row a definition states about itself. */
type MatrixRow = Composition['options'][string];

/**
 * Every facet's composition, by matrix column — what the capability matrix
 * reads a facet's rows from. A self module: it imports the facets
 * themselves, so only the package's own tooling (the matrix, C35, the
 * meta-tests) loads it, never what a consumer installs.
 */
export const COMPOSITIONS: Record<Exclude<Column, 'module'>, Composition> = {
    api: apiFacet.composition,
    cli: cliFacet.composition,
    component: componentFacet.composition,
    integration: integrationFacet.composition,
    jobs: jobsFacet.composition,
    mobile: mobileFacet.composition,
    website: websiteFacet.composition,
};

/** Every row one action states: itself, its options, its visitor, its result. */
function actionRows(action: Composition['actions'][number]): MatrixRow[] {
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
