import { anchorsOf } from '@jterrazz/typescript/rules';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { coordinatesOf, landingOf, pages, ROOT } from '../coordinates.js';

describe('coordinates', () => {
    test("conventions catalogue — the corpus' own coordinates (meta-test) — `links-resolve` — every relative link lands on a file, and every anchor on a heading", () => {
        // Given - the pages, and the anchors each of them offers
        const texts = new Map(
            pages().map((path) => [path, readFileSync(resolve(ROOT, path), 'utf8')]),
        );
        const coordinates = [...texts].flatMap(([path, text]) => coordinatesOf(path, text));

        // Then - no link points at a file or a heading that is not there
        const dangling = coordinates.filter((coordinate) => {
            const landing = landingOf(coordinate);
            if (!existsSync(landing)) {
                return true;
            }
            if (coordinate.fragment === undefined || !landing.endsWith('.md')) {
                return false;
            }
            return !anchorsOf(readFileSync(landing, 'utf8')).has(coordinate.fragment);
        });
        expect(
            dangling.map((coordinate) => `${coordinate.from} -> ${coordinate.target}`),
            'a coordinate the corpus publishes and does not have',
        ).toStrictEqual([]);
        // And - the sweep is not vacuous: a corpus this size carries hundreds
        expect(coordinates.length).toBeGreaterThan(300);
    });

    test("conventions catalogue — the corpus' own coordinates (meta-test) — `links-resolve` — every page of the manual the source cites exists", () => {
        // Given - every page path the source names: a test TITLE and a comment cite pages too, and a move takes the file while leaving those behind
        const cited: string[] = [];
        for (const entry of readdirSync(resolve(ROOT, 'src'), { recursive: true })) {
            const path = `src/${String(entry).replaceAll('\\', '/')}`;
            if (!/\.tsx?$/u.test(path)) {
                continue;
            }
            for (const hit of readFileSync(resolve(ROOT, path), 'utf8').matchAll(
                /\bdocs\/(?:start|guides|concepts|reference)\/[a-z\d-]+\.md/gu,
            )) {
                cited.push(`${path} -> ${hit[0]}`);
            }
        }

        // Then - each one lands on a page that is there
        expect(cited.length).toBeGreaterThan(2);
        expect(
            cited.filter((citation) => !existsSync(resolve(ROOT, citation.split(' -> ')[1] ?? ''))),
            'a page the source cites and the corpus does not have',
        ).toStrictEqual([]);
    });

    test('conventions catalogue — the corpus never offers an option the rulebook refuses — no page restores the all-caps title exemption with `allowedPrefixes`', () => {
        // Given - every page, and the option WRITTEN AS A SETTING (a key, not the word): the rulebook sets no `allowedPrefixes`, so a chapter offering one sends a consumer to a config oxlint rejects, and naming it in prose to say it does not exist has to stay legal
        const swept = pages();
        const claimed = swept.filter((path) =>
            /allowedPrefixes["']?\s*:/u.test(readFileSync(resolve(ROOT, path), 'utf8')),
        );

        // Then - a title opening on an identifier is renamed, or deviated on in the consumer's own fragment
        expect(swept.length).toBeGreaterThan(20);
        expect(claimed, 'a page offering `allowedPrefixes` as a setting').toStrictEqual([]);
    });
});
