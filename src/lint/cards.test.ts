import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    CARD_HEADER,
    deadSignatures,
    FORK,
    KINDS,
    renderCard,
    renderFork,
    SIGNATURES,
    spliceFork,
    uncoveredCapabilities,
} from './cards.js';

/**
 * Meta-tests for the signature cards — the pages an agent reads INSTEAD of a
 * chapter when it already knows which kind it is writing.
 *
 * Two properties, and the second is why the cards are generated at all:
 * freshness (running the generator reproduces every committed card and the
 * fork table spliced into chapter 18), and completeness against the facet
 * declaration in BOTH directions — a capability with no signature would print
 * as a bare name, and a signature no capability claims is a description of
 * something that left.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const REFERENCES = resolve(ROOT, 'skills/jterrazz-test/references');

const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

describe('signature cards — generation freshness (meta-test)', () => {
    test.each(KINDS)('the %s card is byte-identical to a fresh generation', (kind) => {
        // Given - the committed card
        // Then - the generator reproduces it exactly (run `npm run docs`)
        expect(renderCard(kind)).toBe(read(`skills/jterrazz-test/references/${kind}.md`));
    });

    test('the fork reference is byte-identical to a fresh generation', () => {
        // Given - the committed agent-facing fork
        // Then - the generator reproduces it exactly
        expect(renderFork()).toBe(read('skills/jterrazz-test/references/fork.md'));
    });

    test('the fork table inside chapter 18 is byte-identical to a fresh splice', () => {
        // Given - the committed constitution
        const committed = read('docs/18-conventions.md');

        // Then - splicing a fresh table changes nothing: the chapter and the card carry ONE table
        expect(spliceFork(committed)).toBe(committed);
    });
});

describe('signature cards — completeness against the facet declaration (meta-test)', () => {
    test('every capability a card renders has a signature and a line', () => {
        // Given - the groups the cards publish
        // Then - the facet declaration names nothing they cannot describe
        expect(uncoveredCapabilities()).toStrictEqual([]);
    });

    test('no signature describes a capability that left', () => {
        // Given - the signatures this module holds
        // Then - every one of them is still declared by a facet
        expect(deadSignatures()).toStrictEqual([]);
    });

    test('every kind has a card, and every card names a chapter that exists', () => {
        // Given - the eight kinds of the fork
        const cards = readdirSync(REFERENCES).filter((file) => file.endsWith('.md'));

        // Then - each has a file, stamped generated, pointing at a real chapter
        for (const kind of KINDS) {
            expect(cards, `no card for ${kind}`).toContain(`${kind}.md`);
            const card = read(`skills/jterrazz-test/references/${kind}.md`);
            expect(card.startsWith(CARD_HEADER)).toBe(true);
            const chapter = /docs\/(?<file>[\w-]+\.md)/u.exec(card)?.groups?.file;
            expect(chapter, `the ${kind} card names no chapter`).toBeDefined();
            expect(existsSync(resolve(ROOT, 'docs', chapter ?? ''))).toBe(true);
        }
    });

    test('the fork answers for every kind, and for nothing the cards do not cover', () => {
        // Given - the rows of the fork
        const kinds = FORK.map((row) => row.kind);

        // Then - every kind has a row, and the one extra is the repository suite: a placement rule, not a constructor, so it has no card
        for (const kind of KINDS) {
            expect(kinds).toContain(kind);
        }
        const carded = new Set<string>(KINDS);
        expect(kinds.filter((kind) => !carded.has(kind))).toStrictEqual(['repository suite']);
    });

    test('no hand-written card survives beside the generated ones', () => {
        // Given - the reference folder
        const files = readdirSync(REFERENCES).filter((file) => file.endsWith('.md'));
        const generated = new Set([
            ...KINDS.map((kind) => `${kind}.md`),
            'fork.md',
            'matrix.md',
            'rules.md',
        ]);

        // Then - troubleshooting is the one hand-written page left: narration about failures, belonging to no kind
        expect(files.filter((file) => !generated.has(file))).toStrictEqual(['troubleshooting.md']);
    });
});

describe('the skill routes to the cards (meta-test)', () => {
    const skill = (): string => read('skills/jterrazz-test/SKILL.md');

    test('the skill names the major the corpus is written for', () => {
        // Given - the package version and the skill's metadata
        const published = Number(
            /"version": "(?<major>\d+)\./u.exec(read('package.json'))?.groups?.major,
        );
        const stated = Number(/version: '(?<major>\d+)'/u.exec(skill())?.groups?.major);

        // Then - it is the published major, or the one being prepared: the bump that closes the gap is the owner's, and it is the LAST commit of a release rather than the first
        expect(stated).toBeGreaterThanOrEqual(published);
        expect(stated).toBeLessThanOrEqual(published + 1);
    });

    test('every kind has a routing row pointing at its card', () => {
        // Given - the routing table
        const text = skill();

        // Then - no kind is reachable only through prose
        for (const kind of KINDS) {
            expect(text, `no route to ${kind}`).toContain(`references/${kind}.md`);
        }
        expect(text).toContain('references/fork.md');
    });

    test('the skill refuses React Native render tests by name', () => {
        // Given - the "Do NOT use for" section
        // Then - the one runner that stays jest is named, not implied
        expect(skill()).toContain('React Native render tests');
    });

    test('the skill ships no scaffold command', () => {
        // Given - the skill
        // Then - the card is the example; a generator would be a second source of shapes
        expect(skill()).toContain('There is no scaffold command');
    });
});

describe('signature cards — what a card says', () => {
    test('a card carries its own signature table, not a chapter', () => {
        // Given - the api card
        const card = renderCard('api');

        // Then - it names the setups and the terminals by their written form
        expect(card).toContain('`.seed()`');
        expect(card).toContain("`.request('create-user.http')`");
        expect(card).toContain('## Terminal actions (exactly one)');
    });

    test('a kind with no runner says so instead of printing an empty fence', () => {
        // Given - the module card
        const card = renderCard('module');

        // Then - the constructor line is a sentence, and the golden section is a refusal
        expect(card).toContain('**Written as** — Nothing is started');
        expect(card).toContain('None here: a module test may not carry a golden');
    });

    test('a rendered kind routes the vocabulary to its one owner', () => {
        // Given - the component card
        const card = renderCard('component');

        // Then - the words are listed and defined elsewhere, once
        expect(card).toContain('## The vocabulary');
        expect(card).toContain('13-elements.md');
        expect(SIGNATURES['.render()']).toBeDefined();
    });
});
