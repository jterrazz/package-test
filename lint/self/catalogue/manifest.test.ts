import { anchor, spliceBetween } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { RUNTIME_RULES } from '../../../src/chain/refusals/rows.js';
import { FORK_CHAPTER, FORK_MARKERS, forkTable } from '../../consumer/catalogue/fork.js';
import plugin from '../../index.oxlint.js';
import { CATALOGUE_CHAPTER } from '../../kit/catalogue/chapter.js';
import { chapterAt } from '../self.cli.js';
import { SELF_CHAPTER_MARKERS, selfChapterTable } from './chapter.js';
import { allRows, SELF_CHAPTER } from './manifest.js';

const everyRow = [...allRows, ...RUNTIME_RULES];

const ROOT = resolve(import.meta.dirname, '../../..');

const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

describe('manifest', () => {
    test('conventions catalogue — generation freshness (meta-test) — the docs/reference/linting.md catalogue is byte-identical to a fresh generation', () => {
        // Given - the committed docs/reference/linting.md
        const committed = read('docs/reference/linting.md');

        // Then - re-splicing the generated catalogue changes nothing (run `npm run docs`)
        expect(chapterAt(ROOT, 'docs/reference/linting.md', committed)).toBe(committed);
    });

    test('conventions catalogue — generation freshness (meta-test) — the fork table inside the Getting started page is byte-identical to a fresh splice', () => {
        // Given - the committed getting-started chapter
        const committed = readFileSync(resolve(ROOT, FORK_CHAPTER), 'utf8');

        // Then - splicing a fresh table changes nothing
        expect(spliceBetween(committed, FORK_MARKERS, forkTable(), FORK_CHAPTER)).toBe(committed);
    });

    test('conventions catalogue — generation freshness (meta-test) — the docs/guides/test.md table of the self rows is byte-identical to a fresh generation', () => {
        // Given - the committed docs/guides/test.md
        const committed = read(SELF_CHAPTER);

        // Then - re-splicing the self rows changes nothing (run `npm run docs`)
        expect(
            spliceBetween(committed, SELF_CHAPTER_MARKERS, selfChapterTable(), SELF_CHAPTER),
        ).toBe(committed);
    });

    test('conventions catalogue — generation freshness (meta-test) — a row is listed in the chapter of its audience, and only there', () => {
        // Given - the public catalogue and the package's own table
        const published = read(CATALOGUE_CHAPTER);
        const own = read(SELF_CHAPTER);

        // Then - a consumer row is anchored in docs/reference/linting.md alone, a self row in docs/guides/test.md alone: a consumer never reads a rule that holds only this package
        expect(everyRow.length).toBeGreaterThan(0);
        expect(
            everyRow.flatMap((entry) => {
                const [home, away] =
                    entry.audience === 'self' ? [own, published] : [published, own];
                return [
                    home.includes(anchor(entry.name))
                        ? null
                        : `${entry.name} is missing from its chapter`,
                    away.includes(anchor(entry.name))
                        ? `${entry.name} is listed outside its chapter`
                        : null,
                ].filter((broken) => broken !== null);
            }),
        ).toStrictEqual([]);
    });

    test('conventions catalogue — generation freshness (meta-test) — every anchor a rule message links to exists in the generated catalogue', () => {
        // Given - every `docs/reference/linting.md#<id>` a shipped rule's message carries
        const generated = read('docs/reference/linting.md');
        const links = new Set<string>();
        for (const rule of Object.values(plugin.rules)) {
            for (const message of Object.values(rule.meta?.messages ?? {})) {
                for (const found of message.matchAll(
                    /docs\/reference\/linting\.md#(?<id>[\w-]+)/gu,
                )) {
                    links.add(found.groups?.id ?? '');
                }
            }
        }

        // Then - each resolves to a row: a message that links nowhere is worse than one that links to the chapter, because it reads as a route
        expect(links.size).toBeGreaterThan(0);
        expect([...links].filter((id) => !generated.includes(anchor(id)))).toStrictEqual([]);
    });
});
