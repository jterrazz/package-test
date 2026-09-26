import { FAMILIES } from './families.js';
import { consumerRows } from './manifest.js';
import type { Row } from './row.js';

/** Rendered from `manifest.ts` and deterministic: `self/catalogue/manifest.test.ts` asserts the committed chapters are reproduced byte for byte. */

export const DOCS_START =
    '<!-- GENERATED:catalogue — do not edit by hand; run `npm run docs`. Source: lint/catalogue/manifest.ts -->';
export const DOCS_END = '<!-- /GENERATED:catalogue -->';

const published = consumerRows;

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

/** A table row is not a heading: the anchor rides inside the Rule cell, so `docs/19-linting.md#<name>` in a rule message resolves to the row. */
export function anchor(name: string): string {
    return `<a id="${name}"></a>`;
}

function counts(): Record<Row['channel'], number> {
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

const COLUMNS = ['Rule', 'Facet', 'Channel', 'Severity', 'Reach', 'Convention', 'Fix', 'Rationale'];

export function rowTable(rows: Row[]): string[] {
    return table(
        COLUMNS,
        rows.map((entry) => [
            `${anchor(entry.name)}\`${entry.name}\``,
            entry.facet,
            entry.channel,
            entry.severity ?? '—',
            entry.reach,
            cell(entry.convention),
            cell(entry.fix),
            cell(entry.rationale),
        ]),
    );
}

function catalogueSections(): string[] {
    return Object.entries(FAMILIES).flatMap(([family, title]) => {
        const rows = published
            .filter((entry) => entry.family === family)
            .sort((a, b) => CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel]);
        return rows.length === 0
            ? []
            : [[`## ${family} — ${title}`, '', ...rowTable(rows)].join('\n')];
    });
}

function renderCatalogue(): string {
    const c = counts();
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
    const inner = [intro, ...catalogueSections()].join('\n\n');
    return `${DOCS_START}\n\n${inner}\n\n${DOCS_END}`;
}

export function spliceCatalogue(existing: string): string {
    const start = existing.indexOf(DOCS_START);
    const end = existing.indexOf(DOCS_END);
    if (start === -1 || end === -1) {
        throw new Error(
            `docs/19-linting.md is missing the GENERATED:catalogue markers (${DOCS_START} … ${DOCS_END})`,
        );
    }
    return existing.slice(0, start) + renderCatalogue() + existing.slice(end + DOCS_END.length);
}
