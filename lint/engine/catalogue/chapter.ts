import type { Row } from './row.js';

export type Markers = { end: string; start: string };

export function cell(text: string): string {
    return text.replaceAll('|', String.raw`\|`);
}

/** Padded the way oxfmt canonicalizes a table, so the generated chapter is format-clean; every cell character is BMP width-1, so `String.length` is the display width. */
export function table(headers: string[], rows: string[][]): string[] {
    const widths = headers.map((header, index) =>
        Math.max(header.length, 3, ...rows.map((row) => (row[index] ?? '').length)),
    );
    const line = (cells: string[]): string =>
        `| ${cells.map((text, index) => text.padEnd(widths[index] ?? 0)).join(' | ')} |`;
    const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`;
    return [line(headers), separator, ...rows.map(line)];
}

const CHANNEL_ORDER: Record<Row['channel'], number> = {
    statique: 0,
    upstream: 1,
    checker: 2,
    runtime: 3,
    type: 4,
    meta: 5,
    process: 6,
};

export function anchor(name: string): string {
    return `<a id="${name}"></a>`;
}

function counts(published: Row[]): Record<Row['channel'], number> {
    const tally: Record<Row['channel'], number> = {
        checker: 0,
        meta: 0,
        process: 0,
        runtime: 0,
        statique: 0,
        type: 0,
        upstream: 0,
    };
    for (const entry of published) {
        tally[entry.channel] += 1;
    }
    return tally;
}

const COLUMNS = ['Rule', 'Facet', 'Channel', 'Reach', 'Convention', 'Fix', 'Rationale'];

export function rowTable(rows: Row[]): string[] {
    return table(
        COLUMNS,
        rows.map((entry) => [
            `${anchor(entry.name)}\`${entry.name}\``,
            entry.facet,
            entry.channel,
            entry.reach,
            cell(entry.convention),
            cell(entry.fix),
            cell(entry.rationale),
        ]),
    );
}

function catalogueSections(published: Row[], families: Record<string, string>): string[] {
    return Object.entries(families).flatMap(([family, title]) => {
        const rows = published
            .filter((entry) => entry.family === family)
            .sort((a, b) => CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel]);
        return rows.length === 0
            ? []
            : [[`## ${family} — ${title}`, '', ...rowTable(rows)].join('\n')];
    });
}

export function catalogueBody(published: Row[], families: Record<string, string>): string {
    const c = counts(published);
    // A channel with no rows yet is not announced with a zero: a reader would go looking for it.
    const named = [
        [c.statique, '**statique** (oxlint rules)'],
        [c.upstream, '**upstream** (options set on an upstream rule)'],
        [c.checker, '**checker** (bundled passes)'],
        [c.runtime, '**runtime** (execution-time refusals)'],
        [c.type, '**type** (what the compiler refuses)'],
        [c.meta, '**meta** (what a meta-test holds)'],
        [c.process, '**process** (review-borne rules)'],
    ] as const;
    const channels = named
        .filter(([count]) => count > 0)
        .map(([count, label]) => label.replace(' (', ` — ${String(count)} (`))
        .join(', ');
    const intro = `Every rule a project using the framework meets, across its enforcement channels — ${channels} — sourced from one manifest so the code and the catalogue can never drift.`;
    return [intro, ...catalogueSections(published, families)].join('\n\n');
}

export function spliceBetween(
    existing: string,
    markers: Markers,
    body: string,
    page: string,
): string {
    const start = existing.indexOf(markers.start);
    const end = existing.indexOf(markers.end);
    if (start === -1 || end === -1) {
        throw new Error(`${page} is missing its markers (${markers.start} … ${markers.end})`);
    }
    return `${existing.slice(0, start)}${markers.start}\n\n${body}\n\n${existing.slice(end)}`;
}
