import type { OxlintConfig } from '@jterrazz/typescript/oxlint';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { TOKEN_KINDS } from '../model/matching/match.js';
import { anchor, renderRules, spliceCatalog } from './catalog.js';
import { CHECKER_PASS_IDS as CHECKER_PASS_REGISTRY } from './checker.js';
import {
    catalog,
    CHECKER_PASSES,
    FAMILIES,
    META_ROWS,
    PROCESS_RULES,
    RULE_DOCS,
    RUNTIME_RULES,
    TYPE_ROWS,
    UPSTREAM_RULES,
} from './manifest.js';
import plugin, { recommendedRules, testing } from './plugin.js';
import { anchorOf, CATALOGUE_CHAPTER } from './rule-code.js';

/**
 * Catalogue meta-test — the docs-as-code contract.
 *
 * `src/lint/manifest.ts` is the single source of truth for the mechanized rule
 * catalogue; `docs/18-conventions.md` is the hand-maintained constitution
 * (principles + non-mechanizable criteria) and `docs/19-linting.md` carries the
 * GENERATED catalogue. This test guards two invariants:
 *
 * - **freshness** — running the generator reproduces the committed
 *   `docs/19-linting.md` catalogue and `skills/jterrazz-test/references/rules.md`
 *   byte-for-byte;
 * - **completeness** — every shipped rule carries `meta.docs`, and every manifest
 *   entry maps to an implementation (a plugin rule / a checker pass) or a
 *   documented review-borne rule.
 *
 * Plus the standing inventory: every plugin rule has an E2E spec + fixture pair.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

const pluginRules = new Set(Object.keys(plugin.rules));

/**
 * The runtime rows a spec of this package states it proves.
 *
 * A refusal the framework raises has no rule file and no pass to point at, so
 * the spec that drives it says which row it is standing for, in a line above
 * the test: `// RUNTIME <ID> — <the sentence>`. That marker is the channel's
 * inventory, and this reads it.
 */
function runtimeMarkers(): Set<string> {
    const found = new Set<string>();
    for (const root of ['specs', 'src']) {
        for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
            const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
            if (
                (!path.endsWith('.spec.ts') && !path.endsWith('.test.ts')) ||
                path.includes('_fixtures/')
            ) {
                continue;
            }
            for (const match of read(path).matchAll(/\/\/ RUNTIME (?<id>[A-Z]\d+)/gu)) {
                found.add(match.groups?.id ?? '');
            }
        }
    }
    return found;
}

/** The meta rows that have a test naming them — by row name, in this layer. */
function metaProofs(): Set<string> {
    const found = new Set<string>();
    const sources = [
        read('src/lint/plugin.test.ts'),
        read('src/lint/env-allowlist.test.ts'),
        read('src/lint/matrix.test.ts'),
        read('src/lint/siblings.test.ts'),
    ];
    for (const entry of readdirSync(resolve(ROOT, 'specs/lint'), { recursive: true })) {
        const path = String(entry).replaceAll('\\', '/');
        if (path.endsWith('.test.ts') && !path.includes('_fixtures/')) {
            sources.push(read(`specs/lint/${path}`));
        }
    }
    for (const row of META_ROWS) {
        const id = row.id.toLowerCase();
        if (sources.some((text) => text.includes(`${id} —`) || text.includes(row.name))) {
            found.add(row.name);
        }
    }
    return found;
}

/**
 * The checker-only passes (the non-oxlint static channel, bundled in
 * dist/checker.js) — derived from the checker module's own registry (coordinator
 * decision d) so the meta-test cannot drift from the passes the CLI runs.
 */
const CHECKER_PASS_IDS = new Set<string>(CHECKER_PASS_REGISTRY);

/**
 * Specs/lint E2E files that probe the checker's CLI boundary rather than a
 * single rule/pass (exit codes, argument handling), plus the D11 kitchen-sink
 * — one project tripping every checker pass at once, asserted as a single
 * full-output golden — legitimately outside the rule↔fixture inventory below.
 */
const CLI_CONTRACT_SPECS = new Set(['checker-cli', 'kitchen-sink', 'member-pass']);

describe('the composable fragment — what a consumer wires', () => {
    test('`testing` is an oxlint config, so compose(<profile>, testing) needs no assertion', () => {
        // Given - the fragment as a consumer's oxlint.config.ts receives it. The annotation IS the test: an inferred `rules` widens each severity to `string`, which oxlint's closed union refuses, and this line stops compiling — no consumer should need `testing as OxlintConfig`.
        const composed: OxlintConfig = testing;

        // Then - it carries the plugin wiring and the whole catalogue
        expect(composed.jsPlugins).toStrictEqual(['@jterrazz/test/oxlint']);
        expect(composed.rules).toBe(recommendedRules);
    });
});

/** The rules of the fragment's override over the test globs. */
function testGlobRules(): Record<string, unknown> {
    const layer = (testing.overrides ?? []).find((entry) =>
        entry.files.some((glob) => glob.includes('test,spec')),
    );
    return { ...layer?.rules };
}

/** One upstream entry, read as the pair `['error', <options>]` it has to be. */
function optionOf(rule: string): { options: Record<string, string>; severity: unknown } {
    const entry: unknown = testGlobRules()[rule];
    const pair: unknown[] = Array.isArray(entry) ? entry : [];
    const [severity, options] = pair;
    const named: Record<string, string> = {};
    if (typeof options === 'object' && options !== null) {
        for (const [key, value] of Object.entries(options)) {
            named[key] = String(value);
        }
    }
    return { options: named, severity };
}

describe('the upstream options this vocabulary owns (ADR-005)', () => {
    test('d20 — the seven snapshot matchers are refused, each naming the golden', () => {
        // Given - the option the fragment sets on vitest's own rule
        const { options: matchers, severity } = optionOf('vitest/no-restricted-matchers');

        // Then - every matcher vitest offers for snapshots is named, with a destination
        expect(severity).toBe('error');
        expect(Object.keys(matchers).toSorted()).toStrictEqual([
            'toMatchAriaSnapshot',
            'toMatchFileSnapshot',
            'toMatchInlineSnapshot',
            'toMatchScreenshot',
            'toMatchSnapshot',
            'toThrowErrorMatchingInlineSnapshot',
            'toThrowErrorMatchingSnapshot',
        ]);
        for (const [matcher, message] of Object.entries(matchers)) {
            expect(message.length, `${matcher} states no fix`).toBeGreaterThan(0);
        }
    });

    test('m3 — the four vi methods that take a seam, and not the one that restores itself', () => {
        // Given - the option the fragment sets
        const { options: methods, severity } = optionOf('vitest/no-restricted-vi-methods');

        // Then - the clock and the global stub are named; `stubEnv` is sanctioned
        expect(severity).toBe('error');
        expect(Object.keys(methods).toSorted()).toStrictEqual([
            'setSystemTime',
            'stubGlobal',
            'useFakeTimers',
            'useRealTimers',
        ]);
        expect(methods).not.toHaveProperty('stubEnv');
    });

    test('j10 — one level of describe, and no more', () => {
        // Given - the option the fragment sets on vitest's own rule
        const { options, severity } = optionOf('vitest/max-nested-describe');

        // Then - a second level of context is refused
        expect(severity).toBe('error');
        expect(options).toStrictEqual({ max: '1' });
    });
});

describe('conventions catalogue — generation freshness (meta-test)', () => {
    test('the docs/13 catalogue is byte-identical to a fresh generation', () => {
        // Given - the committed docs/19-linting.md
        const committed = read('docs/19-linting.md');

        // Then - re-splicing the generated catalogue changes nothing (run `npm run docs`)
        expect(spliceCatalog(committed)).toBe(committed);
    });

    test('every anchor a rule message links to exists in the generated catalogue', () => {
        // Given - every `docs/19-linting.md#<id>` a shipped rule's message carries
        const generated = read('docs/19-linting.md');
        const links = new Set<string>();
        for (const rule of Object.values(plugin.rules)) {
            for (const message of Object.values(rule.meta?.messages ?? {})) {
                for (const found of message.matchAll(/docs\/19-linting\.md#(?<id>[\w-]+)/gu)) {
                    links.add(found.groups?.id ?? '');
                }
            }
        }

        // Then - each resolves to a row: a message that links nowhere is worse than one that links to the chapter, because it reads as a route
        expect(links.size).toBeGreaterThan(0);
        for (const id of links) {
            expect(generated, `dead anchor docs/19-linting.md#${id}`).toContain(anchor(id));
        }
    });

    test('the generated skill rule reference is byte-identical to a fresh generation', () => {
        // Given - the committed agent-facing rule reference
        // Then - the generator reproduces it exactly (run `npm run docs`)
        expect(renderRules()).toBe(read('skills/jterrazz-test/references/rules.md'));
    });
});

/**
 * Whole words only: `qui` is inside "required", `est` inside "test". The
 * deny-list is about a SENTENCE coming back, not about letters.
 */
function carries(text: string, token: string): boolean {
    return new RegExp(String.raw`(?<![\p{L}'’])${token}(?![\p{L}'’])`, 'u').test(
        text.toLowerCase(),
    );
}

describe('conventions catalogue — completeness (meta-test)', () => {
    test('every shipped plugin rule carries a statique meta.docs entry', () => {
        // Given - each shipped jterrazz/* rule, and the manifest read by rule id
        const docsById: Record<string, unknown> = RULE_DOCS;
        for (const [id, rule] of Object.entries(plugin.rules)) {
            // Then - it attaches its manifest doc as meta.docs (channel statique)
            expect(rule.meta?.docs, `rule ${id} is missing meta.docs`).toBeDefined();
            expect(rule.meta?.docs).toBe(docsById[id]);
            expect(rule.meta?.docs?.channel).toBe('statique');
        }
    });

    test('the statique docs cover exactly the shipped plugin rules', () => {
        // Given - the statique docs and the plugin map
        // Then - the two sets are identical (no orphan doc, no undocumented rule)
        expect(Object.keys(RULE_DOCS).sort()).toStrictEqual([...pluginRules].sort());
    });

    test('every checker-channel manifest entry maps to a bundled checker pass', () => {
        // Given - the checker channel of the manifest
        // Then - each entry names a real pass run by dist/checker.js
        expect(CHECKER_PASSES.map((entry) => entry.name).sort()).toStrictEqual(
            [...CHECKER_PASS_IDS].sort(),
        );
    });

    test('runtime and process manifest entries are documented (convention + rationale)', () => {
        // Given - the review-borne / execution-time channels
        for (const entry of [...RUNTIME_RULES, ...PROCESS_RULES]) {
            // Then - each carries non-empty normative text and a rationale (its "implementation" is the framework runtime or human review — documented here, not a lint rule)
            expect(entry.convention.length, `${entry.name} convention`).toBeGreaterThan(0);
            expect(entry.rationale.length, `${entry.name} rationale`).toBeGreaterThan(0);
        }
    });

    test('k5 — no catalogue sentence has gone back to French', () => {
        // Given - the tokens the manifest actually carried while it was French. A deny-list of the KNOWN corpus, not a language heuristic: the point is to catch a row being written back in the old language, and a heuristic would argue with every borrowed word the domain has
        const FRENCH = [
            'aucun',
            'chaque',
            'dossier',
            'erreur',
            'est une',
            'fichier',
            'interdit',
            'jamais',
            'le framework',
            'même',
            'n’est',
            'qui',
            'règle',
            'sous',
            'toute',
            'une spec',
        ];

        // Then - every sentence the catalogue publishes is English
        for (const entry of catalog) {
            const sentences = `${entry.convention} ${entry.rationale} ${entry.fix}`;
            for (const token of FRENCH) {
                expect(
                    carries(sentences, token),
                    `${entry.name} carries the French token "${token}"`,
                ).toBe(false);
            }
        }
        for (const [letter, title] of Object.entries(FAMILIES)) {
            for (const token of FRENCH) {
                expect(
                    carries(title, token),
                    `family ${letter} carries the French token "${token}"`,
                ).toBe(false);
            }
        }
    });

    test('k3 — every diagnostic ends with its own generated anchor', () => {
        // Given - the shipped plugin, whose messages carry a generated tail
        const chapter = read(CATALOGUE_CHAPTER);
        for (const [name, rule] of Object.entries(plugin.rules)) {
            const id = rule.meta?.docs?.id ?? '';
            const tail = anchorOf(id, name);
            for (const [key, message] of Object.entries(rule.meta?.messages ?? {})) {
                // Then - it routes to a heading that EXISTS in the chapter
                expect(message.endsWith(tail), `${name}.${key} is missing its anchor`).toBe(true);
            }
            expect(chapter).toContain(`<a id="${name}"></a>`);
        }
    });

    test('every catalogue row states its reach and its fix', () => {
        // Given - the assembled catalogue
        for (const entry of catalog) {
            // Then - a reader deciding whether a rule applies to the file in front of them never has to read its implementation
            expect(entry.reach.length, `${entry.name} reach`).toBeGreaterThan(0);
            expect(entry.fix.length, `${entry.name} fix`).toBeGreaterThan(0);
        }
    });

    test('a statique row that states a role gate has one', () => {
        // Given - every statique row whose reach is one KIND of file — `tests` and `all` are out, because a rule gated on a SHAPE (a `.fixture()` literal, a `.trigger()` name) looks at every file and finds that shape only in a test, which is what its convention says
        const ROLE_REACH = new Set([
            'component',
            'config',
            'contract',
            'document',
            'ground',
            'module',
            'spec',
            'specification',
        ]);

        // Then - its rule asks `roleOf` (directly, or through the predicate that reads it): a row naming ONE kind while the implementation reads none is a sentence, and W2 was one — any file with a `.visit/.render/.open` scenario was judged
        for (const entry of catalog) {
            if (entry.channel !== 'statique' || !ROLE_REACH.has(entry.reach)) {
                continue;
            }
            const source = read(`src/lint/rules/${entry.facet}/${entry.name}.ts`);
            expect(
                source.includes('roleOf(') || source.includes('isTestRole('),
                `${entry.name} states reach \`${entry.reach}\` and reads no role`,
            ).toBe(true);
        }
    });

    test('every catalogue row names exactly ONE channel', () => {
        // Given - the seven-channel vocabulary
        const CHANNELS = new Set([
            'checker',
            'meta',
            'process',
            'runtime',
            'statique',
            'type',
            'upstream',
        ]);

        // Then - each row says which pass a reader should expect its finding from
        for (const entry of catalog) {
            expect(CHANNELS.has(entry.channel), `${entry.name} channel`).toBe(true);
        }
    });

    test('every catalogue entry has a unique implementation name', () => {
        // Given - the assembled catalogue
        // Then - no two entries share a name (each maps to a distinct implementation)
        const names = new Set<string>();
        for (const entry of catalog) {
            expect(names.has(entry.name), `duplicate catalogue entry ${entry.name}`).toBeFalsy();
            names.add(entry.name);
        }
    });
});

describe('testing fragment — standalone oxlint config', () => {
    test('is self-sufficient (no `extends` needed): plugin + every rule + the A4 override', () => {
        // Given - a consumer NOT using @jterrazz/typescript adopts just the conventions via `export default testing` — the fragment must be a COMPLETE oxlint config
        // Then - it registers the tool-facing plugin, enables every shipped rule, and ships the one override the A4 idiom needs — without pulling in any base preset
        expect(testing.jsPlugins).toContain('@jterrazz/test/oxlint');
        expect(testing.rules).toBe(recommendedRules);
        expect(Object.keys(recommendedRules)).toStrictEqual(
            Object.keys(plugin.rules).map((id) => `jterrazz/${id}`),
        );
        expect(testing.overrides?.[0]?.files).toContain('**/*.specification.ts');
        // A standalone config carries no `extends` — the fragment stands on its own.
        expect('extends' in testing).toBeFalsy();
    });

    test('declares no `categories` — every rule it ships is decided by name', () => {
        // Given - the fragment, top level and every override entry (the `categories` block in specs/_fixtures/lint-cli/oxlint.e2e.json is a test harness muting oxlint's own defaults, not a config this package ships)
        const layers: Record<string, unknown>[] = [
            testing as unknown as Record<string, unknown>,
            ...((testing.overrides ?? []) as unknown as Record<string, unknown>[]),
        ];

        // Then - none of them opens a category: a category turns on rules nobody decided, and composing it over a base preset silently re-enables them
        for (const layer of layers) {
            expect('categories' in layer).toBeFalsy();
        }
    });

    test('the only `warn` levels are the advisory `w` channel', () => {
        // Given - each rule the fragment enables (its `rules` IS this map, above)
        for (const [id, level] of Object.entries(recommendedRules)) {
            // Then - `warn` belongs to the redundancy heuristics (`<family><n>w-…`) and nothing else; every hard convention is an error. The estate's rulebook has no warn tier — this package's `w` channel is its one documented exception (see the manifest's statique channel note)
            const advisory = /^jterrazz\/\w+w-/u.test(id);
            expect(level, `${id} is ${level}`).toBe(advisory ? 'warn' : 'error');
        }
    });

    test('its overrides add a layer instead of replacing one', () => {
        // Given - each override entry of the fragment
        for (const entry of testing.overrides ?? []) {
            // Then - it is scoped by `files` and carries `rules` only, so a profile already holding its own overrides (v10 puts the `vitest` plugin on the test globs that way) keeps them: oxlint concatenates the arrays
            expect(entry.files.length).toBeGreaterThan(0);
            expect(Object.keys(entry).sort()).toStrictEqual(['files', 'rules']);
        }
    });
});

describe('conventions catalogue — the channels answer for themselves (meta-test)', () => {
    /** Every id the catalogue publishes, as the corpus would cite it. */
    const rowIds = new Set(catalog.map((entry) => entry.id));

    /** The files a citation can live in — the corpus a reader follows. */
    const citingFiles = (): string[] => {
        const found: string[] = [];
        for (const root of ['docs', 'skills']) {
            for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
                const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
                // A decision record is written once and never edited: it names
                // The rules its decision REMOVED, and those ids resolve to
                // Nothing by design. The generated reference is nobody's prose.
                const historical =
                    path.startsWith('docs/reference/') || path.startsWith('docs/decisions/');
                if (path.endsWith('.md') && !historical) {
                    found.push(path);
                }
            }
        }
        found.push('README.md');
        return found;
    };

    /** The letters a family is spelled with — what makes a citation one. */
    const letters = Object.keys(FAMILIES).join('');

    /**
     * The four shapes a citation takes in this corpus: `rule X` / `rules X, Y`,
     * the parenthesised tail a message and a comment end on (`(C18)`), the
     * `CONVENTIONS X/Y` a source comment opens on, and a possessive (`D7's`).
     *
     * The first shape alone was the whole check, and every id the 16.0 wave
     * retired outlived it somewhere: in a parenthesised tail, in a heading, in
     * an example a consumer copies.
     */
    const citationPatterns = (): RegExp[] => [
        new RegExp(
            String.raw`\brules?\s+((?:[${letters}]\d+w?)(?:\s*(?:,|and|/)\s*[${letters}]\d+w?)*)`,
            'gu',
        ),
        new RegExp(
            String.raw`\bCONVENTIONS\s+((?:[${letters}]\d+w?)(?:/[${letters}]\d+w?)*)`,
            'gu',
        ),
        new RegExp(String.raw`\(([${letters}]\d+w?)(?:\s+—[^)]*)?\)`, 'gu'),
        new RegExp(String.raw`\b([${letters}]\d+w?)'s\b`, 'gu'),
    ];

    /** Every file of the LAYER that implements the surface — comments cite too. */
    const citingSources = (): string[] => {
        const found: string[] = [];
        for (const root of ['src', 'specs']) {
            for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
                const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
                if (path.endsWith('.ts') || path.endsWith('.tsx')) {
                    found.push(path);
                }
            }
        }
        return found;
    };

    test('k2 — every id the corpus cites resolves to a row', () => {
        // Given - every citation shape the corpus uses, in the chapters, the skill, the messages the plugin ships and the comments of the code that implements them. The families are the vocabulary: a citation is a family letter and a number, and nothing else is one
        const cited = new Map<string, string>();
        const collect = (text: string, where: string): void => {
            for (const pattern of citationPatterns()) {
                for (const match of text.matchAll(pattern)) {
                    for (const id of (match[1] ?? '').split(/[\s,/]+|and/u).filter(Boolean)) {
                        cited.set(id.replace(/w$/u, ''), where);
                    }
                }
            }
        };
        for (const file of [...citingFiles(), ...citingSources()]) {
            collect(read(file), file);
        }
        for (const [name, rule] of Object.entries(plugin.rules)) {
            for (const message of Object.values(rule.meta?.messages ?? {})) {
                collect(message, name);
            }
        }

        // Then - each resolves to a row a reader can open
        expect(cited.size).toBeGreaterThan(0);
        for (const [id, where] of cited) {
            expect(rowIds.has(id), `${where} cites rule ${id}, which resolves to no row`).toBe(
                true,
            );
        }
    });

    test('k2 — every rule NAME the corpus cites resolves to a rule or a pass', () => {
        // Given - every implementation name the corpus spells, in the chapters, the skill and the code. A retired rule leaves its name behind in an example a consumer copies, and oxlint refuses a config naming a rule it does not know — the whole file, not the line
        const known = [
            ...Object.keys(plugin.rules),
            ...CHECKER_PASS_IDS,
            ...catalog.map((entry) => entry.name),
        ];
        // A fixture tree is named after the rule it stands for, with a tail
        // Saying which case it holds — the inventory meta-test already pairs
        // Each of them with its rule, so the directory listing IS the vocabulary.
        const names = new Set([
            ...known,
            ...readdirSync(resolve(ROOT, 'specs/_fixtures/lint-violations')),
            // A golden is named after the case it holds, which is the rule's
            // Name plus what the run did to the tree.
            ...readdirSync(resolve(ROOT, 'specs/lint/checker/_expected')).map((file) =>
                file.replace(/\.[a-z]+$/u, ''),
            ),
        ]);
        const pattern = new RegExp(
            String.raw`(?:^|[^\w\-#])([${letters.toLowerCase()}]\d+w?(?:-[a-z0-9]+)+)(?![\w-])`,
            'gu',
        );
        const cited = new Map<string, string>();
        for (const file of [...citingFiles(), ...citingSources()]) {
            for (const line of read(file).split('\n')) {
                // A migration sentence NAMES what it retired — that is what it
                // Is for, and a consumer's config still naming one is what it
                // Warns about. The names on that line are gone by design.
                if (line.includes('no longer exist')) {
                    continue;
                }
                for (const match of line.matchAll(pattern)) {
                    cited.set(match[1] ?? '', file);
                }
            }
        }

        // Then - each names something that exists
        expect(cited.size).toBeGreaterThan(0);
        for (const [name, where] of cited) {
            expect(
                names.has(name),
                `${where} names \`${name}\`, which is no rule of this plugin`,
            ).toBe(true);
        }
    });

    test('m1 — every constructor has a specs tree in this package', () => {
        // Given - the six constructors, and the trees this package specifies itself on
        const constructors = ['api', 'cli', 'integration', 'jobs', 'mobile', 'website'];
        const trees = new Set(readdirSync(resolve(ROOT, 'specs')));

        // Then - each has one, except mobile: a simulator is not a container, and the facet is proven on a consumer rather than here (docs/03)
        for (const facet of constructors) {
            const exempt = facet === 'mobile';
            expect(trees.has(facet), `${facet} has no specs tree`).toBe(!exempt);
        }
        expect(read('docs/03-testing.md')).toContain('mobile');

        // Then - the seventh subject is held too: `component` is a chain rather than a constructor, so its tree is the fixture app its colocated `.test.tsx` files sit in
        expect(trees.has('component-app'), 'component has no fixture app tree').toBe(true);
        expect(
            readdirSync(resolve(ROOT, 'specs/component-app')).some((entry) =>
                entry.endsWith('.test.tsx'),
            ),
            'specs/component-app holds no rendered unit',
        ).toBe(true);
    });

    test('every channel answers for its rows the way the channel can', () => {
        // Given - the seven channels, each with the proof its rows owe
        const proofs: [
            string,
            (entry: { id: string; name: string; upstream?: string }) => boolean,
        ][] = [
            ['statique', (entry) => pluginRules.has(entry.name)],
            ['checker', (entry) => CHECKER_PASS_IDS.has(entry.name)],
            [
                // The row names the upstream rule it rests on, and the proof is
                // An assertion on THAT rule's resolved option — a file-level
                // Check passed for any row as long as one assertion existed.
                'upstream',
                (entry) =>
                    entry.upstream !== undefined &&
                    read('src/lint/plugin.test.ts').includes(`optionOf('${entry.upstream}')`),
            ],
            ['type', (entry) => read('src/type-channel.test-d.ts').includes(entry.id)],
            ['runtime', (entry) => runtimeMarkers().has(entry.id)],
            ['meta', (entry) => metaProofs().has(entry.name)],
            ['process', (entry) => entry.name.length > 0],
        ];

        // Then - no row of any channel is a sentence with nothing behind it
        for (const [channel, proven] of proofs) {
            const rows = catalog.filter((entry) => entry.channel === channel);
            expect(rows.length, `${channel} has no rows`).toBeGreaterThan(0);
            for (const row of rows) {
                expect(proven(row), `${row.name} (${channel}) has no proof`).toBe(true);
            }
        }
    });

    test('the four channels that are not code still carry their vocabulary', () => {
        // Given - the rows the manifest holds outside the two rule channels
        // Then - each names a family the catalogue publishes, so the generated chapter has a section to put it in
        const families = [...UPSTREAM_RULES, ...TYPE_ROWS, ...META_ROWS].map(
            (row) => FAMILIES[row.family] ?? `${row.name} names no family`,
        );
        expect(families.filter((title) => title.includes('names no family'))).toStrictEqual([]);
    });
});

describe('conventions catalogue — E2E inventory (meta-test)', () => {
    // E2E specs are grouped by CONVENTIONS family (specs/lint/<group>/<id>.test.ts,
    // Their fixtures pooled in $FIXTURES) — collect the rule id from each file.
    const e2eSpecIds = new Set(
        readdirSync(resolve(ROOT, 'specs/lint'), { recursive: true })
            .map((entry) => String(entry).replaceAll('\\', '/'))
            // A spec's own ground is material it stands on, never a spec: the
            // Reach fixture holds a file in every role, and each one is named
            // For what it is rather than for a rule.
            .filter((entry) => entry.endsWith('.test.ts') && !entry.includes('_fixtures/'))
            .map((entry) => entry.slice(entry.lastIndexOf('/') + 1, -'.test.ts'.length)),
    );

    test('every plugin rule has a specs/lint E2E spec and a fixture pair', () => {
        // Given - each shipped rule
        for (const id of pluginRules) {
            // Then - its E2E spec file and violation/compliant fixture twin exist
            expect(e2eSpecIds.has(id), `${id} has no E2E spec`).toBeTruthy();
            expect(existsSync(resolve(ROOT, 'specs/_fixtures/lint-violations', id))).toBeTruthy();
            expect(
                existsSync(resolve(ROOT, 'specs/_fixtures/lint-violations', `${id}-ok`)),
            ).toBeTruthy();
        }
    });

    test('every specs/lint E2E spec maps to a plugin rule or a checker pass', () => {
        // Given - each E2E spec id, and the meta rows that have a spec of their own
        const metaRows = new Set(META_ROWS.map((row) => row.name));
        for (const id of e2eSpecIds) {
            // Then - it is a shipped rule, a known checker pass, a meta row, or A CLI-contract probe
            expect(
                pluginRules.has(id) ||
                    CHECKER_PASS_IDS.has(id) ||
                    CLI_CONTRACT_SPECS.has(id) ||
                    metaRows.has(id),
                `${id} maps to no rule, pass, meta row, or CLI-contract spec`,
            ).toBeTruthy();
        }
    });

    test('the reach config enables exactly the rules the standard one does', () => {
        // Given - the two standalone configs the lint E2E specs run with
        const rulesOf = (path: string): string[] => {
            const parsed: unknown = JSON.parse(read(path));
            const rules =
                typeof parsed === 'object' && parsed !== null && 'rules' in parsed
                    ? parsed.rules
                    : {};
            return typeof rules === 'object' && rules !== null ? Object.keys(rules) : [];
        };

        // Then - the reach fixture is judged by the SAME catalogue; only C1's declared depth differs, which is what the fixture is there to state
        expect(rulesOf('specs/_fixtures/lint-cli/oxlint.reach.json').toSorted()).toStrictEqual(
            rulesOf('specs/_fixtures/lint-cli/oxlint.e2e.json').toSorted(),
        );
    });

    test('the E2E lint config (oxlint.e2e.json) enables exactly the shipped rule set', () => {
        // Given - the standalone oxlint config the checker E2E specs lint their violation fixtures with
        const config = JSON.parse(read('specs/_fixtures/lint-cli/oxlint.e2e.json')) as {
            rules: Record<string, unknown>;
        };

        // Then - its rule keys match recommendedRules exactly: no rule ships without an E2E lint pass, and no stale rule lingers in the fixture config
        expect(Object.keys(config.rules).sort()).toStrictEqual(
            Object.keys(recommendedRules).sort(),
        );
    });

    test('the docs/09 token table matches TOKEN_KINDS exactly', () => {
        // Given - the token reference table's first-column cells (`| `{{kind}}` |`)
        const documented = new Set(
            read('docs/15-tokens.md')
                .split('\n')
                .map((line) => /^\|\s*`\{\{(?<kind>[a-z0-9]+)\}\}`\s*\|/u.exec(line)?.groups?.kind)
                .filter((kind): kind is string => kind !== undefined),
        );

        // Then - identical to the frozen vocabulary
        expect([...documented].sort()).toStrictEqual([...TOKEN_KINDS].sort());
    });
});

/**
 * Meta-test K8 — every coordinate inside the corpus resolves.
 *
 * A chapter reaches another chapter by a relative path and a heading anchor,
 * and both halves rot silently: a renamed heading leaves a link that scrolls
 * nowhere, a renumbered chapter leaves one that 404s. The 16.0 renumbering
 * moved every file at once and the map's own row still pointed at a heading
 * the same commit had replaced.
 *
 * K3 already holds the anchors a rule MESSAGE points at; this holds the ones
 * the prose does. Generated pages are swept too — a card nobody proof-reads is
 * exactly where a dead coordinate survives.
 */
/** GitHub's heading slug: lowercased, punctuation dropped, spaces hyphenated. */
function slugOf(heading: string): string {
    return heading
        .trim()
        .toLowerCase()
        .replaceAll(/[^\s\w-]/gu, '')
        .replaceAll(/\s/gu, '-');
}

/** Every anchor a page offers: the slug of each of its headings. */
function anchorsOf(text: string): Set<string> {
    const found = new Set<string>();
    for (const line of text.split('\n')) {
        const heading = /^#{1,6}\s+(?<title>.+?)\s*$/u.exec(line)?.groups?.title;
        if (heading !== undefined) {
            found.add(slugOf(heading));
        }
    }
    return found;
}

/** One link of one page, as a coordinate to check. */
type Coordinate = { fragment: string | undefined; from: string; target: string };

/** Every relative link a page carries — an absolute url is somebody else's. */
function coordinatesOf(from: string, text: string): Coordinate[] {
    const found: Coordinate[] = [];
    for (const match of text.matchAll(/\]\((?<target>[^)\s]+)\)/gu)) {
        const target = match.groups?.target ?? '';
        if (target.startsWith('http') || target.startsWith('mailto:')) {
            continue;
        }
        found.push({ fragment: target.split('#')[1], from, target });
    }
    return found;
}

describe('the corpus’ own coordinates (meta-test K8)', () => {
    /** Every markdown page a reader follows, hand-written or generated. */
    const pages = (): string[] => {
        const found: string[] = ['README.md', 'AGENTS.md', 'TODO.md'];
        for (const root of ['docs', 'skills']) {
            for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
                const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
                // The typedoc projection is regenerated from a clone, not
                // Written here, and its internal links are typedoc's own.
                if (path.endsWith('.md') && !path.startsWith('docs/reference/')) {
                    found.push(path);
                }
            }
        }
        return found.filter((path) => existsSync(resolve(ROOT, path)));
    };

    /** Where a link lands on disk, from the page that carries it. */
    const landingOf = (coordinate: Coordinate): string => {
        const file = coordinate.target.split('#')[0];
        return file === undefined || file === ''
            ? resolve(ROOT, coordinate.from)
            : resolve(ROOT, coordinate.from, '..', file);
    };

    test('every relative link lands on a file, and every anchor on a heading', () => {
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
});
