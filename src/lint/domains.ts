import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { cell, table } from './catalog.js';

/**
 * The domain names a facet's spec tree may carry.
 *
 * C1 says a facet keeps its runners at its root and its tests one level down,
 * in domain folders; it says nothing about what those folders are CALLED, and
 * the name is the reading. Six capabilities belong to no facet in particular —
 * a runner's `lifecycle`, the declared network (`intercepts`), the ground a
 * chain loads (`seeding`), what a result answers (`assertions`), the
 * `{{token}}` engine (`tokens`) and the pinned calendar (`clock`) — and a facet
 * that gives one of them its own folder calls it by the shared name, so
 * `specs/api/clock/` and `specs/website/clock/` are the same question asked of
 * two constructors.
 *
 * Everything else is one facet's own, and the defect this module exists to stop
 * is a name that drifts: two facets calling one capability two things, or a
 * facet inventing `fixtures/` beside another's `seeding/`. So the vocabulary is
 * declared here and `domains.test.ts` holds the tree equal to it, in both
 * directions.
 *
 * What it does NOT say is that a capability is only ever exercised under its
 * own name: `.seed()` is used inside jobs' `triggering/` scenarios, because
 * seeding is the Given there and not the subject. The rule is about what a
 * FOLDER is called, not about where a method may appear.
 */

/** The six capabilities that belong to no facet in particular. */
export const SHARED_DOMAINS = [
    'assertions',
    'clock',
    'intercepts',
    'lifecycle',
    'seeding',
    'tokens',
] as const;

/** Each facet's own domains — a name here may not appear under another facet. */
export const FACET_DOMAINS: Record<string, string[]> = {
    api: ['initiation-errors', 'requests', 'responses'],
    cli: ['directory', 'docker', 'env', 'exec', 'literate'],
    integration: ['call', 'golden', 'postgres', 'redis'],
    jobs: ['triggering'],
    website: ['console', 'fetch', 'services', 'visit'],
};

/** The domain folders a facet carries on disk, sorted. Ground (`_…`) is not a domain. */
export function domainsOf(root: string, facet: string): string[] {
    try {
        return readdirSync(resolve(root, 'specs', facet), { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
            .map((entry) => entry.name)
            .toSorted();
    } catch {
        return [];
    }
}

/** Markers delimiting the generated domain table inside `docs/03-testing.md`. */
export const DOMAINS_START =
    '<!-- GENERATED:domains — do not edit by hand; run `npm run docs`. Source: src/lint/domains.ts -->';
export const DOMAINS_END = '<!-- /GENERATED:domains -->';

/** A list of folder names as one cell, or an em dash when there are none. */
function folders(names: string[]): string {
    return names.length === 0 ? '—' : names.map((entry) => `\`${entry}/\``).join(', ');
}

/** The domain table: per facet, which shared names it carries and which are its own. */
export function renderDomains(root: string): string {
    const shared = new Set<string>(SHARED_DOMAINS);
    const rows = Object.keys(FACET_DOMAINS)
        .toSorted()
        .map((facet) => {
            const found = domainsOf(root, facet);
            return [
                `\`${facet}\``,
                cell(folders(found.filter((entry) => shared.has(entry)))),
                cell(folders(found.filter((entry) => !shared.has(entry)))),
            ];
        });
    return table(['Facet', 'Shared domains it carries', 'Its own'], rows).join('\n');
}

/** Replace the region between the GENERATED:domains markers of chapter 03. */
export function spliceDomains(existing: string, root: string): string {
    const start = existing.indexOf(DOMAINS_START);
    const end = existing.indexOf(DOMAINS_END);
    if (start === -1 || end === -1) {
        throw new Error(
            `docs/03-testing.md is missing the GENERATED:domains markers (${DOMAINS_START} … ${DOMAINS_END})`,
        );
    }
    return `${existing.slice(0, start) + DOMAINS_START}\n\n${renderDomains(root)}\n\n${existing.slice(end)}`;
}
