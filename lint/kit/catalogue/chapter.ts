import { anchor, cell, markdownTable } from '@jterrazz/typescript/rules';

import type { Row } from './row.js';

export const CATALOGUE_CHAPTER = 'docs/reference/linting.md';

const CHANNEL_ORDER: Record<Row['channel'], number> = {
    static: 0,
    upstream: 1,
    toolchain: 2,
    checker: 3,
    runtime: 4,
    type: 5,
    meta: 6,
    process: 7,
};

function counts(published: Row[]): Record<Row['channel'], number> {
    const tally: Record<Row['channel'], number> = {
        checker: 0,
        meta: 0,
        process: 0,
        runtime: 0,
        static: 0,
        toolchain: 0,
        type: 0,
        upstream: 0,
    };
    for (const entry of published) {
        tally[entry.channel] += 1;
    }
    return tally;
}

const COLUMNS = ['Rule', 'Specification', 'Channel', 'Reach', 'Convention', 'Fix', 'Rationale'];

export function rowTable(rows: Row[]): string {
    return markdownTable(
        COLUMNS,
        rows.map((entry) => [
            `${anchor(entry.name)}\`${entry.name}\``,
            entry.specification,
            entry.channel,
            entry.reach,
            cell(entry.sentence),
            cell(entry.fix),
            cell(entry.rationale),
        ]),
    );
}

function catalogueSections(published: Row[], families: Record<string, string>): string[] {
    return Object.entries(families).flatMap(([family, title]) => {
        const rows = published
            .filter((entry) => entry.family === family)
            .toSorted((a, b) => CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel]);
        return rows.length === 0 ? [] : [[`## ${family}: ${title}`, '', rowTable(rows)].join('\n')];
    });
}

export function catalogueBody(published: Row[], families: Record<string, string>): string {
    const c = counts(published);
    // invariant: a channel with no rows yet is not announced with a zero: a reader would go looking for it.
    const named = [
        [c.static, '**static** (oxlint rules)'],
        [c.upstream, '**upstream** (options set on an upstream rule)'],
        [c.toolchain, '**toolchain** (the preset @jterrazz/typescript runs)'],
        [c.checker, '**checker** (bundled passes)'],
        [c.runtime, '**runtime** (execution-time refusals)'],
        [c.type, '**type** (what the compiler refuses)'],
        [c.meta, '**meta** (what a meta-test holds)'],
        [c.process, '**process** (review-borne rules)'],
    ] as const;
    const channels = named
        .filter(([count]) => count > 0)
        .map(([count, label]) => label.replace(' (', `: ${String(count)} (`))
        .join(', ');
    const intro = `Every rule a project using the framework meets, across its enforcement channels (${channels}), sourced from one manifest so the code and the catalogue can never drift.`;
    return [intro, ...catalogueSections(published, families)].join('\n\n');
}
