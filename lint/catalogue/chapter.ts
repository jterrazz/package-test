import { consumerCatalog, FAMILIES } from './manifest.js';
import type { CatalogEntry } from './manifest.js';

/** Rendered from `manifest.ts` and deterministic: `plugin.test.ts` asserts the committed chapters are reproduced byte for byte. */

export const DOCS_START =
    '<!-- GENERATED:catalog — do not edit by hand; run `npm run docs`. Source: lint/catalogue/manifest.ts -->';
export const DOCS_END = '<!-- /GENERATED:catalog -->';

const published = consumerCatalog;

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

const CHANNEL_ORDER: Record<CatalogEntry['channel'], number> = {
    statique: 0,
    upstream: 1,
    checker: 2,
    runtime: 3,
    type: 4,
    meta: 5,
    process: 6,
};

/** A table row is not a heading: the anchor rides inside the Implementation cell, so `docs/19-linting.md#<implementation>` in a rule message resolves to the row. */
export function anchor(name: string): string {
    return `<a id="${name}"></a>`;
}

function families(rows: CatalogEntry[]): string[] {
    return [...new Set(rows.map((entry) => entry.family))].sort((a, b) => a.localeCompare(b));
}

/** `model` first, then one section per facet: a reader adopting one constructor stops after two sections. */
const FACET_ORDER = ['model', 'api', 'cli', 'component', 'integration', 'job', 'mobile', 'website'];

function facets(): string[] {
    const present = new Set<string>(published.map((entry) => entry.facet));
    return FACET_ORDER.filter((facet) => present.has(facet));
}

const FACET_TITLES: Record<string, string> = {
    api: 'the HTTP app, met through its entry',
    cli: 'the command binary and its literate documents',
    component: 'a rendered unit, in a page',
    integration: 'a module against the real thing',
    job: 'what a name triggers in-process',
    mobile: 'a native screen on a simulator',
    model: 'every facet, whichever constructor you reach for',
    website: 'the served site, driven in a browser',
};

function counts(): Record<CatalogEntry['channel'], number> {
    const tally: Record<CatalogEntry['channel'], number> = {
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

const COLUMNS = ['Code', 'Implementation', 'Channel', 'Reach', 'Convention', 'Fix', 'Rationale'];

export function rowTable(rows: CatalogEntry[]): string[] {
    return table(
        COLUMNS,
        rows.map((entry) => [
            entry.id,
            `${anchor(entry.name)}\`${entry.name}\``,
            entry.channel,
            entry.reach,
            cell(entry.convention),
            cell(entry.fix),
            cell(entry.rationale),
        ]),
    );
}

function catalogueSections(): string[] {
    return facets().flatMap((facet) => {
        const owned = published.filter((entry) => entry.facet === facet);
        const tables = families(owned).map((family) => {
            const rows = owned
                .filter((entry) => entry.family === family)
                .sort((a, b) => CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel]);
            return [`### ${family} — ${FAMILIES[family] ?? family}`, '', ...rowTable(rows)].join(
                '\n',
            );
        });
        tables.unshift(`## ${facet} — ${FACET_TITLES[facet] ?? facet}`);
        return tables;
    });
}

function renderDocsCatalog(): string {
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

export function spliceCatalog(existing: string): string {
    const start = existing.indexOf(DOCS_START);
    const end = existing.indexOf(DOCS_END);
    if (start === -1 || end === -1) {
        throw new Error(
            `docs/19-linting.md is missing the GENERATED:catalog markers (${DOCS_START} … ${DOCS_END})`,
        );
    }
    return existing.slice(0, start) + renderDocsCatalog() + existing.slice(end + DOCS_END.length);
}
