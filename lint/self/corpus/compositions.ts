import { apiFacet } from '../../../src/facets/api/api.facet.js';
import { cliFacet } from '../../../src/facets/cli/cli.facet.js';
import { componentFacet } from '../../../src/facets/component/component.facet.js';
import { integrationFacet } from '../../../src/facets/integration/integration.facet.js';
import { jobFacet } from '../../../src/facets/job/job.facet.js';
import { lintFacet } from '../../../src/facets/lint/lint.facet.js';
import { mobileFacet } from '../../../src/facets/mobile/mobile.facet.js';
import { websiteFacet } from '../../../src/facets/website/website.facet.js';
import type { Composition } from '../../../src/kernel/chain/define-facet.js';
import type { Column } from './facet-matrix.js';

type MatrixRow = Composition['options'][string];

/** It imports the facets themselves, so only this package's own tooling loads it. */
export const COMPOSITIONS: Record<Exclude<Column, 'module'>, Composition> = {
    api: apiFacet.composition,
    cli: cliFacet.composition,
    component: componentFacet.composition,
    integration: integrationFacet.composition,
    job: jobFacet.composition,
    lint: lintFacet.composition,
    mobile: mobileFacet.composition,
    website: websiteFacet.composition,
};

function actionRows(action: Composition['actions'][number]): MatrixRow[] {
    return [
        action.row,
        ...(action.options ?? []).map((option) => option.row),
        ...(action.verbs ?? []),
        ...(action.targets ?? []),
        ...action.accessors,
    ];
}

function keyOf(row: MatrixRow): string {
    return `${row.group} · ${row.name}`;
}

/** A row stated by two definitions counts once; stated with two probes it is refused, since a row counts by one probe. */
export function rowsOfCompositions(composition: Composition): MatrixRow[] {
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
