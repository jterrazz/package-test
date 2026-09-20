import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { domainsOf, FACET_DOMAINS, SHARED_DOMAINS, spliceDomains } from './domains.js';

/** The repository root, from this module's place inside `src/lint/`. */
const ROOT = resolve(import.meta.dirname, '../..');

/**
 * Meta-test — the spec tree speaks one vocabulary.
 *
 * Chapter 03 says a capability two facets share carries the same domain name in
 * both. That was prose with nothing behind it, and prose is how `fixtures/`
 * ends up beside `seeding/`: two names for one thing, and a reader who has to
 * open both to find out.
 */
describe('the spec tree’s domain vocabulary', () => {
    test('every domain on disk is a shared name or that facet’s declared own', () => {
        // Given - the folders each facet actually carries
        const shared = new Set<string>(SHARED_DOMAINS);

        // Then - none of them is a name nobody declared
        for (const [facet, own] of Object.entries(FACET_DOMAINS)) {
            const undeclared = domainsOf(ROOT, facet).filter(
                (domain) => !shared.has(domain) && !own.includes(domain),
            );
            expect(undeclared, `${facet} carries a domain nothing declares`).toStrictEqual([]);
        }
    });

    test('no declared domain is dead', () => {
        // Given - the same declaration
        // Then - a name nobody carries is a folder that left, and it goes with it
        for (const [facet, own] of Object.entries(FACET_DOMAINS)) {
            const onDisk = domainsOf(ROOT, facet);
            expect(
                own.filter((domain) => !onDisk.includes(domain)),
                `${facet} declares a domain that is not there`,
            ).toStrictEqual([]);
        }
    });

    test('a name one facet owns is never another facet’s', () => {
        // Given - the facets' own names, which are the ones that are NOT shared
        const seen = new Map<string, string>();

        // Then - a name in two trees means one capability, so it belongs to the shared list
        for (const [facet, own] of Object.entries(FACET_DOMAINS)) {
            for (const domain of own) {
                const first = seen.get(domain);
                expect(
                    first,
                    `\`${domain}/\` is ${first ?? ''}'s and ${facet}'s — a shared capability takes a shared name`,
                ).toBeUndefined();
                seen.set(domain, facet);
            }
        }
    });

    test('the table chapter 03 publishes is byte-identical to a fresh generation', () => {
        // Given - the generated reading of the tree
        const chapter = readFileSync(resolve(ROOT, 'docs/03-testing.md'), 'utf8');

        // Then - regenerating reproduces it exactly
        expect(spliceDomains(chapter, ROOT)).toBe(chapter);
    });
});
