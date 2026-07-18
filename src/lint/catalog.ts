import { catalog, type CatalogEntry, FAMILIES, RULE_DOCS } from './manifest.js';

/**
 * The conventions-catalogue generator — renders the mechanized rule catalogue
 * FROM `manifest.ts` (the source of truth) into two committed artifacts:
 *
 * - the rule table inside `docs/10-linting.md`, spliced between GENERATED
 *   markers ({@link spliceDocsTable});
 * - the full four-channel annex `CONVENTIONS-CATALOG.md` ({@link renderAnnex}).
 *
 * Output is deterministic (the manifest is pre-sorted), so `plugin.test.ts` can
 * assert freshness: running the generator must reproduce the committed files
 * byte-for-byte. `catalog-cli.ts` (bundled as `dist/catalog.js`) writes them;
 * `npm run docs` chains it.
 */

/** Markers delimiting the generated rule table inside `docs/10-linting.md`. */
export const DOCS_START =
    '<!-- GENERATED:catalog — do not edit by hand; run `npm run docs`. Source: src/lint/manifest.ts -->';
export const DOCS_END = '<!-- /GENERATED:catalog -->';

/** Escape a markdown table cell (pipes would split the row). */
function cell(text: string): string {
    return text.replaceAll('|', String.raw`\|`);
}

/**
 * Render a GitHub-flavoured markdown table the way oxfmt (prettier) canonicalizes
 * one: each column padded to its widest cell (min 3). Emitting this form keeps the
 * generated files format-clean, so the freshness meta-test and the formatter agree.
 * All cell characters are BMP width-1 (Latin, arrows, curly quotes), so
 * `String.length` equals the display width.
 */
function table(headers: string[], rows: string[][]): string[] {
    const widths = headers.map((header, index) =>
        Math.max(header.length, 3, ...rows.map((row) => row[index].length)),
    );
    const line = (cells: string[]): string =>
        `| ${cells.map((text, index) => text.padEnd(widths[index])).join(' | ')} |`;
    const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`;
    return [line(headers), separator, ...rows.map(line)];
}

/** `true` for the redundancy-heuristic rules (ids like `a6w-…`), shipped as warnings. */
function isWarn(name: string): boolean {
    return /\dw-/u.test(name);
}

/**
 * The `docs/10-linting.md` rule table — the statique channel only (the shipped
 * `jterrazz/*` rules), each row anchored `| `jterrazz/<id>` |` so consumers and
 * the meta-test can parse it. The other three channels live in the annex.
 */
export function renderDocsTable(): string {
    const rows = Object.keys(RULE_DOCS)
        .sort()
        .map((name) => {
            const doc = RULE_DOCS[name];
            const code = isWarn(name) ? `${doc.id} (warn)` : doc.id;
            return [`\`jterrazz/${name}\``, code, cell(doc.convention)];
        });
    return [
        DOCS_START,
        '',
        ...table(['Rule', 'Convention', 'Enforces'], rows),
        '',
        `> Full four-channel catalogue (statique + checker + runtime + process): [\`/CONVENTIONS-CATALOG.md\`](../CONVENTIONS-CATALOG.md), generated from the same manifest.`,
        '',
        DOCS_END,
    ].join('\n');
}

/** Replace the region between the GENERATED markers of `docs/10` with a fresh table. */
export function spliceDocsTable(existing: string): string {
    const start = existing.indexOf(DOCS_START);
    const end = existing.indexOf(DOCS_END);
    if (start === -1 || end === -1) {
        throw new Error(
            `docs/10-linting.md is missing the GENERATED:catalog markers (${DOCS_START} … ${DOCS_END})`,
        );
    }
    return existing.slice(0, start) + renderDocsTable() + existing.slice(end + DOCS_END.length);
}

const CHANNEL_ORDER: Record<CatalogEntry['channel'], number> = {
    statique: 0,
    checker: 1,
    runtime: 2,
    process: 3,
};

/**
 * The generated annex `CONVENTIONS-CATALOG.md` — every catalogue entry across
 * all four channels, grouped by convention family, sorted deterministically.
 */
export function renderAnnex(): string {
    const families = [...new Set(catalog.map((entry) => entry.family))].sort((a, b) =>
        a.localeCompare(b),
    );
    const sections = families.map((family) => {
        const rows = catalog
            .filter((entry) => entry.family === family)
            .sort((a, b) => CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel])
            .map((entry) => [
                entry.id,
                `\`${entry.name}\``,
                entry.channel,
                cell(entry.convention),
                cell(entry.rationale),
            ]);
        return [
            `## ${family} — ${FAMILIES[family] ?? family}`,
            '',
            ...table(['Code', 'Implementation', 'Channel', 'Convention', 'Rationale'], rows),
        ].join('\n');
    });

    const counts = {
        checker: catalog.filter((entry) => entry.channel === 'checker').length,
        process: catalog.filter((entry) => entry.channel === 'process').length,
        runtime: catalog.filter((entry) => entry.channel === 'runtime').length,
        statique: catalog.filter((entry) => entry.channel === 'statique').length,
    };

    const parts = [
        '# Conventions catalogue (generated)',
        '> **GENERATED — do not edit by hand.** Run `npm run docs` (or `make docs`) to regenerate from `src/lint/manifest.ts`. The normative principles, enforcement channels and non-mechanizable criteria live in the hand-maintained constitution [`/CONVENTIONS.md`](CONVENTIONS.md); this file is the mechanized per-rule catalogue it points to.',
        `Every rule the framework enforces, across its four channels — **statique** (${counts.statique} oxlint rules), **checker** (${counts.checker} bundled passes), **runtime** (${counts.runtime} execution-time refusals), **process** (${counts.process} review-borne rules) — sourced from one manifest so the code and the catalogue can never drift.`,
        ...sections,
    ];
    return `${parts.join('\n\n')}\n`;
}
