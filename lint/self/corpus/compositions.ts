import type { Composition } from '../../../src/chain/define-specification.js';
import { apiDefinition } from '../../../src/specifications/api/api.composition.js';
import { cliDefinition } from '../../../src/specifications/cli/cli.composition.js';
import { componentDefinition } from '../../../src/specifications/component/component.composition.js';
import { integrationDefinition } from '../../../src/specifications/integration/integration.composition.js';
import { jobDefinition } from '../../../src/specifications/job/job.composition.js';
import { lintDefinition } from '../../../src/specifications/lint/lint.composition.js';
import { mobileDefinition } from '../../../src/specifications/mobile/mobile.composition.js';
import { websiteDefinition } from '../../../src/specifications/website/website.composition.js';
import type { Column } from './specification-matrix.js';

type MatrixRow = Composition['options'][string];

/** It imports the specifications themselves, so only this package's own tooling loads it. */
export const COMPOSITIONS: Record<Exclude<Column, 'module'>, Composition> = {
    api: apiDefinition.composition,
    cli: cliDefinition.composition,
    component: componentDefinition.composition,
    integration: integrationDefinition.composition,
    job: jobDefinition.composition,
    lint: lintDefinition.composition,
    mobile: mobileDefinition.composition,
    website: websiteDefinition.composition,
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
