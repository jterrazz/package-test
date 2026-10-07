import { byName } from '@jterrazz/typescript/rules';

import type { Row as CatalogueRow } from '../../kit/catalogue/row.js';
import { SPECIFICATIONS } from '../../kit/project/specifications.js';
import { FAMILIES } from './families.js';
import type { Family } from './families.js';
import MANIFEST from './manifest.json' with { type: 'json' };

type Row = CatalogueRow<Family>;

const SPECIFICATION_LIST = [...SPECIFICATIONS]
    .map((specification) => `\`${specification}\``)
    .join(', ');

const TEXT_FIELDS = [
    'audience',
    'channel',
    'specification',
    'fix',
    'name',
    'rationale',
    'reach',
    'sentence',
];

const isFamily = (value: unknown): value is Family =>
    typeof value === 'string' && Object.keys(FAMILIES).includes(value);

function isRow(value: unknown): value is Row {
    return (
        typeof value === 'object' &&
        value !== null &&
        TEXT_FIELDS.every((field) => typeof Reflect.get(value, field) === 'string') &&
        isFamily(Reflect.get(value, 'family'))
    );
}

function rowsOf(channel: keyof typeof MANIFEST): Row[] {
    return MANIFEST[channel].map((entry) => {
        const row: unknown = Object.assign(structuredClone(entry), {
            sentence: entry.sentence.replaceAll('<specifications>', SPECIFICATION_LIST),
        });
        if (!isRow(row)) {
            throw new Error(
                `lint/consumer/catalogue/manifest.json holds a ${channel} row of no known shape: ${entry.name}`,
            );
        }
        return row;
    });
}

/** Each rule file attaches its entry as `meta.docs`. A convention oxlint's own `vitest` plugin enforces belongs there, not here. */
export const STATIC_RULES: Row[] = rowsOf('static');

export const TOOLCHAIN_RULES: Row[] = rowsOf('toolchain');

export const CHECKER_PASSES: Row[] = rowsOf('checker');

export const TYPE_ROWS: Row[] = rowsOf('type');

export const UPSTREAM_RULES: Row[] = rowsOf('upstream');

/** Review-borne; listed so the catalogue is complete, the constitution keeps their rationale. */
export const PROCESS_RULES: Row[] = rowsOf('process');

export const consumerRows: Row[] = byName([
    ...STATIC_RULES,
    ...UPSTREAM_RULES,
    ...TOOLCHAIN_RULES,
    ...TYPE_ROWS,
    ...CHECKER_PASSES,
    ...PROCESS_RULES,
]);

export const recommendedRules: Readonly<Record<string, 'error'>> = Object.fromEntries(
    consumerRows
        .filter(({ channel }) => channel === 'static')
        .map(({ name }) => [`jterrazz/${name}`, 'error']),
);
