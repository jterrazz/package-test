import { materialAt, testPackageOf } from '@jterrazz/test/oxlint';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { TOKEN_KINDS } from '../src/expectations/tokens/match.js';
import { lessonParts } from '../src/kernel/refusals/lesson.js';
import { anchor, spliceCatalog, spliceSelfRules } from './catalog.js';
import { CHECKER_PASS_IDS as CHECKER_PASS_REGISTRY } from './checker.js';
import {
    CHECKER_PASSES,
    consumerCatalog,
    FAMILIES,
    PROCESS_RULES,
    RULE_DOCS,
    RUNTIME_RULES,
    TYPE_ROWS,
    UPSTREAM_RULES,
} from './manifest.js';
import plugin, { recommendedRules, testing } from './plugin.js';
import { CATALOGUE_CHAPTER } from './rule-code.js';
import { SELF_PASS_IDS } from './self-checker.js';
import {
    catalog,
    META_ROWS,
    SELF_CHAPTER,
    SELF_CHECKER_PASSES,
    SELF_PROCESS_RULES,
    SELF_RULE_DOCS,
    selfCatalog,
} from './self-manifest.js';
import selfPlugin, { selfRules } from './self-plugin.js';

/**
 * Catalogue meta-test — the docs-as-code contract.
 *
 * `lint/manifest.ts` is the single source of truth for the mechanized rule
 * catalogue; `docs/18-conventions.md` is the hand-maintained constitution
 * (principles + non-mechanizable criteria) and `docs/19-linting.md` carries the
 * GENERATED catalogue. This test guards two invariants:
 *
 * - **freshness** — running the generator reproduces the committed
 *   `docs/19-linting.md` catalogue byte-for-byte;
 * - **completeness** — every shipped rule carries `meta.docs`, and every manifest
 *   entry maps to an implementation (a plugin rule / a checker pass) or a
 *   documented review-borne rule.
 *
 * Plus the standing inventory: every plugin rule is specified by documents that
 * golden its position, and every checker pass has an E2E spec.
 */
const ROOT = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

/** Every oxlint rule this repository runs, by id — the published plugin's and the self plugin's. */
const allRules = { ...plugin.rules, ...selfPlugin.rules };

const pluginRules = new Set(Object.keys(allRules));

/** The plugin a rule reports under: `jterrazz-self` for a self rule, `jterrazz` for the rest. */
function namespaceOf(id: string): string {
    return id in selfPlugin.rules ? 'jterrazz-self' : 'jterrazz';
}

/** The statique rows of one audience, by rule id. */
function statiqueRowsOf(audience: string): string[] {
    return Object.entries({ ...RULE_DOCS, ...SELF_RULE_DOCS })
        .filter(([, doc]) => doc.audience === audience)
        .map(([id]) => id)
        .toSorted();
}

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
                path.includes('fixtures/')
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
        read('lint/plugin.test.ts'),
        read('lint/architecture.test.ts'),
        read('lint/audience.test.ts'),
        read('lint/document-report.test.ts'),
        read('lint/env-allowlist.test.ts'),
        read('lint/lesson.test.ts'),
        read('lint/matrix.test.ts'),
        read('lint/port-readers.test.ts'),
        read('lint/siblings.test.ts'),
    ];
    for (const entry of readdirSync(resolve(ROOT, 'specs/lint'), { recursive: true })) {
        const path = String(entry).replaceAll('\\', '/');
        if (path.endsWith('.test.ts') && !path.includes('fixtures/')) {
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

/** The passes only this package runs — `dist/self-checker.js`, never shipped. */
const SELF_PASSES = new Set<string>(SELF_PASS_IDS);

/** The audiences a list of rows declares, each once. */
function audiences(rows: { audience: string }[]): string[] {
    return [...new Set(rows.map((row) => row.audience))];
}

/** The checker-channel rows of one audience, by name. */
function checkerRowsOf(audience: string): string[] {
    return [...CHECKER_PASSES, ...SELF_CHECKER_PASSES]
        .filter((entry) => entry.audience === audience)
        .map((entry) => entry.name)
        .toSorted();
}

/**
 * Specs/lint E2E files that probe the checker's CLI boundary rather than a
 * single rule/pass (exit codes, argument handling), plus the D11 kitchen-sink
 * — one project tripping every checker pass at once, asserted as a single
 * full-output golden — legitimately outside the rule↔fixture inventory below.
 */
const CLI_CONTRACT_SPECS = new Set([
    'checker-cli',
    'checker-ratchet',
    'kitchen-sink',
    'member-pass',
]);

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

/**
 * Whole words only: `qui` is inside "required", `est` inside "test". The
 * deny-list is about a SENTENCE coming back, not about letters.
 */
function carries(text: string, token: string): boolean {
    return new RegExp(String.raw`(?<![\p{L}'’])${token}(?![\p{L}'’])`, 'u').test(
        text.toLowerCase(),
    );
}

/** The files a citation can live in — the corpus a reader follows. */
const citingFiles = (): string[] => {
    const found: string[] = [];
    for (const root of ['docs', 'skills']) {
        for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
            const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
            // A decision record is written once and never edited: it names
            // The rules its decision REMOVED, and those ids resolve to
            // Nothing by design.
            if (path.endsWith('.md') && !path.startsWith('docs/decisions/')) {
                found.push(path);
            }
        }
    }
    found.push('README.md');
    return found;
};

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

/** What a name may resolve to: a rule, a pass, a row — and the cases named after one. */
const knownNames = (): Set<string> =>
    new Set([
        ...pluginRules,
        ...CHECKER_PASS_IDS,
        ...SELF_PASSES,
        ...catalog.map((entry) => entry.name),
        // A fixture tree is named after the rule it stands for, with a tail
        // Saying which case it holds — the inventory meta-test already pairs
        // Each of them with its rule, so the directory listing IS the vocabulary.
        ...readdirSync(resolve(ROOT, 'specs/lint/checker/fixtures/lint-violations')),
        // A golden is named after the case it holds, which is the rule's
        // Name plus what the run did to the tree.
        ...readdirSync(resolve(ROOT, 'specs/lint/checker/expected')).map((file) =>
            file.replace(/\.[a-z]+$/u, ''),
        ),
    ]);

/** Every id the catalogue publishes, as the corpus would cite it. */
const rowIds = new Set(catalog.map((entry) => entry.id));

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
    new RegExp(String.raw`\bCONVENTIONS\s+((?:[${letters}]\d+w?)(?:/[${letters}]\d+w?)*)`, 'gu'),
    new RegExp(String.raw`\(([${letters}]\d+w?)(?:\s+—[^)]*)?\)`, 'gu'),
    new RegExp(String.raw`\b([${letters}]\d+w?)'s\b`, 'gu'),
];

/** Every rule id a text cites, in any of the four shapes, its warning tail dropped. */
const idsCitedIn = (text: string): string[] =>
    citationPatterns().flatMap((pattern) =>
        [...text.matchAll(pattern)].flatMap((match) =>
            (match[1] ?? '')
                .split(/[\s,/]+|and/u)
                .filter(Boolean)
                .map((id) => id.replace(/w$/u, '')),
        ),
    );

/** Every implementation name a line spells: a family letter, a number, a kebab tail. */
const namesCitedIn = (line: string): string[] =>
    [
        ...line.matchAll(
            new RegExp(
                String.raw`(?:^|[^\w\-#])([${letters.toLowerCase()}]\d+w?(?:-[a-z0-9]+)+)(?![\w-])`,
                'gu',
            ),
        ),
    ].map((match) => match[1] ?? '');

/** The rules a standalone config enables, by name. */
const rulesOf = (path: string): string[] => {
    const parsed: unknown = JSON.parse(read(path));
    const rules =
        typeof parsed === 'object' && parsed !== null && 'rules' in parsed ? parsed.rules : {};
    return typeof rules === 'object' && rules !== null ? Object.keys(rules) : [];
};

// A rule's E2E specification takes one of two forms: its documents in
// `specs/lint/<id>/` with their fixtures beside them, or a
// `specs/lint/<group>/<id>.test.ts` over a fixture pair in the pool.
const entries = readdirSync(resolve(ROOT, 'specs/lint'), { recursive: true }).map((entry) =>
    String(entry).replaceAll('\\', '/'),
);

const withDocuments = new Set(
    entries
        .filter((entry) => /^[a-z0-9-]+\/[^/]+\.spec\.yaml$/u.test(entry))
        .map((entry) => entry.slice(0, entry.indexOf('/'))),
);

const e2eSpecIds = new Set([
    ...withDocuments,
    ...entries
        // A spec's own ground is material it stands on, never a spec: the
        // Reach fixture holds a file in every role, and each one is named
        // For what it is rather than for a rule.
        .filter((entry) => entry.endsWith('.test.ts') && !entry.includes('fixtures/'))
        .map((entry) => entry.slice(entry.lastIndexOf('/') + 1, -'.test.ts'.length)),
]);

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

/** Every anchor a page offers: the slug of each of its headings, and each explicit `<a id>`. */
function anchorsOf(text: string): Set<string> {
    const found = new Set<string>();
    for (const line of text.split('\n')) {
        const heading = /^#{1,6}\s+(?<title>.+?)\s*$/u.exec(line)?.groups?.title;
        if (heading !== undefined) {
            found.add(slugOf(heading));
        }
        // A catalogue row carries its own anchor, the rule id — a link may land on it.
        for (const rowAnchor of line.matchAll(/<a id="(?<id>[^"]+)"><\/a>/gu)) {
            found.add(rowAnchor.groups?.id ?? '');
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

/** Every markdown page a reader follows. */
function pages(): string[] {
    const found: string[] = ['README.md', 'AGENTS.md', 'TODO.md'];
    for (const root of ['docs', 'skills']) {
        for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
            const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
            if (path.endsWith('.md')) {
                found.push(path);
            }
        }
    }
    return found.filter((path) => existsSync(resolve(ROOT, path)));
}

/** Where a link lands on disk, from the page that carries it. */
const landingOf = (coordinate: Coordinate): string => {
    const file = coordinate.target.split('#')[0];
    return file === undefined || file === ''
        ? resolve(ROOT, coordinate.from)
        : resolve(ROOT, coordinate.from, '..', file);
};

/** The two test-material readers the `./oxlint` entry publishes. */
type MaterialReaders = { materialAt: typeof materialAt; testPackageOf: typeof testPackageOf };

/** What one build's readers answer for a module id and a specifier of each kind. */
function answersOf(readers: MaterialReaders): unknown[] {
    return [
        readers.materialAt(resolve(ROOT, 'src/index.test.ts')),
        readers.materialAt(resolve(ROOT, 'specs/shared/fixtures/api-app/app.ts')),
        readers.materialAt(resolve(ROOT, 'specs/shared'), true),
        readers.materialAt(resolve(ROOT, 'src/index.ts')),
        readers.testPackageOf('vitest/config'),
        readers.testPackageOf('@testing-library/react'),
        readers.testPackageOf('@jterrazz/test/oxlint'),
        readers.testPackageOf('hono'),
    ];
}

describe('plugin', () => {
    test('the composable fragment — what a consumer wires — `testing` is an oxlint config, so compose(<profile>, testing) needs no assertion', () => {
        // Given - the fragment as a consumer's oxlint.config.ts receives it. The annotation IS the test: an inferred `rules` widens each severity to `string`, which oxlint's closed union refuses, and this line stops compiling — no consumer should need `testing as OxlintConfig`.
        const composed: OxlintConfig = testing;

        // Then - it carries the plugin wiring and the whole catalogue
        expect(composed.jsPlugins).toStrictEqual(['@jterrazz/test/oxlint']);
        expect(composed.rules).toBe(recommendedRules);
    });

    test('the upstream options this vocabulary owns (ADR-005) — d20 — the seven snapshot matchers are refused, each naming the golden', () => {
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

    test('the upstream options this vocabulary owns (ADR-005) — m3 — the four vi methods that take a seam, and not the one that restores itself', () => {
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

    test('the upstream options this vocabulary owns (ADR-005) — c31 — the top-level describe keeps the case of the subject it names', () => {
        // Given - the option the fragment sets on vitest's own rule
        const { options, severity } = optionOf('vitest/prefer-lowercase-title');

        // Then - a test title is still lower-cased, the file's describe is not
        expect(severity).toBe('error');
        expect(options).toStrictEqual({ ignoreTopLevelDescribe: 'true' });
    });

    test('the upstream options this vocabulary owns (ADR-005) — j10 — one level of describe, and no more', () => {
        // Given - the option the fragment sets on vitest's own rule
        const { options, severity } = optionOf('vitest/max-nested-describe');

        // Then - a second level of context is refused
        expect(severity).toBe('error');
        expect(options).toStrictEqual({ max: '1' });
    });

    test('conventions catalogue — generation freshness (meta-test) — the docs/19 catalogue is byte-identical to a fresh generation', () => {
        // Given - the committed docs/19-linting.md
        const committed = read('docs/19-linting.md');

        // Then - re-splicing the generated catalogue changes nothing (run `npm run docs`)
        expect(spliceCatalog(committed)).toBe(committed);
    });

    test('conventions catalogue — generation freshness (meta-test) — the docs/03 table of the self rows is byte-identical to a fresh generation', () => {
        // Given - the committed docs/03-testing.md
        const committed = read(SELF_CHAPTER);

        // Then - re-splicing the self rows changes nothing (run `npm run docs`)
        expect(spliceSelfRules(committed)).toBe(committed);
    });

    test('conventions catalogue — generation freshness (meta-test) — a row is listed in the chapter of its audience, and only there', () => {
        // Given - the public catalogue and the package's own table
        const published = read(CATALOGUE_CHAPTER);
        const own = read(SELF_CHAPTER);

        // Then - a consumer row is anchored in docs/19 alone, a self row in docs/03 alone: a consumer never reads a rule that holds only this package
        for (const entry of catalog) {
            const [home, away] = entry.audience === 'self' ? [own, published] : [published, own];
            expect(home, `${entry.name} is missing from its chapter`).toContain(anchor(entry.name));
            expect(away, `${entry.name} is listed outside its chapter`).not.toContain(
                anchor(entry.name),
            );
        }
    });

    test('conventions catalogue — generation freshness (meta-test) — every anchor a rule message links to exists in the generated catalogue', () => {
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

    test('conventions catalogue — completeness (meta-test) — every shipped plugin rule carries a statique meta.docs entry', () => {
        // Given - each rule of either plugin, and the manifest read by rule id
        const docsById: Record<string, unknown> = { ...RULE_DOCS, ...SELF_RULE_DOCS };
        for (const [id, rule] of Object.entries(allRules)) {
            // Then - it attaches its manifest doc as meta.docs (channel statique)
            expect(rule.meta?.docs, `rule ${id} is missing meta.docs`).toBeDefined();
            expect(rule.meta?.docs).toBe(docsById[id]);
            expect(rule.meta?.docs?.channel).toBe('statique');
        }
    });

    test('conventions catalogue — completeness (meta-test) — the statique docs cover exactly the rules of the plugin their audience loads', () => {
        // Given - the statique docs, split by audience, and the two plugin maps
        // Then - a consumer row is a rule of the published plugin, a self row one of the self plugin, and neither plugin registers a rule of the other audience
        expect(statiqueRowsOf('consumer')).toStrictEqual(Object.keys(plugin.rules).toSorted());
        expect(statiqueRowsOf('self')).toStrictEqual(Object.keys(selfPlugin.rules).toSorted());
    });

    test('conventions catalogue — completeness (meta-test) — every checker-channel manifest entry maps to a pass of the checker its audience runs', () => {
        // Given - the checker channel of the manifest, split by audience
        // Then - a consumer row names a pass dist/checker.js runs, a self row one dist/self-checker.js runs, and neither checker runs a pass of the other audience
        expect(checkerRowsOf('consumer')).toStrictEqual([...CHECKER_PASS_IDS].toSorted());
        expect(checkerRowsOf('self')).toStrictEqual([...SELF_PASSES].toSorted());
    });

    test('conventions catalogue — completeness (meta-test) — runtime and process manifest entries are documented (convention + rationale)', () => {
        // Given - the review-borne / execution-time channels
        for (const entry of [...RUNTIME_RULES, ...PROCESS_RULES, ...SELF_PROCESS_RULES]) {
            // Then - each carries non-empty normative text and a rationale (its "implementation" is the framework runtime or human review — documented here, not a lint rule)
            expect(entry.convention.length, `${entry.name} convention`).toBeGreaterThan(0);
            expect(entry.rationale.length, `${entry.name} rationale`).toBeGreaterThan(0);
        }
    });

    test('conventions catalogue — completeness (meta-test) — k5 — no catalogue sentence has gone back to French', () => {
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

    test('conventions catalogue — completeness (meta-test) — k3 — every diagnostic reads at its own row, on a heading that exists', () => {
        // Given - the rules of both plugins, whose messages carry a generated `read:` part, and the chapter each audience's rows live in
        for (const [name, rule] of Object.entries(allRules)) {
            const chapter = rule.meta.docs.audience === 'self' ? SELF_CHAPTER : CATALOGUE_CHAPTER;
            for (const [key, message] of Object.entries(rule.meta?.messages ?? {})) {
                // Then - it routes to its own row's heading, in its audience's chapter, and the heading EXISTS there
                expect(lessonParts(message)?.read, `${name}.${key} reads elsewhere`).toBe(
                    `${chapter}#${name}`,
                );
            }
            expect(read(chapter)).toContain(`<a id="${name}"></a>`);
        }
    });

    test('conventions catalogue — completeness (meta-test) — every catalogue row states its reach and its fix', () => {
        // Given - the assembled catalogue
        for (const entry of catalog) {
            // Then - a reader deciding whether a rule applies to the file in front of them never has to read its implementation
            expect(entry.reach.length, `${entry.name} reach`).toBeGreaterThan(0);
            expect(entry.fix.length, `${entry.name} fix`).toBeGreaterThan(0);
        }
    });

    test('conventions catalogue — completeness (meta-test) — a statique row that states a role gate has one', () => {
        // Given - every statique row whose reach is one KIND of file — `tests` and `all` are out, because a rule gated on a SHAPE (a `.fixture()` literal, a `.trigger()` name) looks at every file and finds that shape only in a test, which is what its convention says
        const ROLE_REACH = new Set([
            'component',
            'config',
            'stub',
            'document',
            'ground',
            'module',
            'spec',
            'specification',
        ]);

        // Then - its rule asks the file's role (`identityOf`, or the predicate that reads it): a row naming ONE kind while the implementation reads none is a sentence, and W2 was one — any file with a `.visit/.render/.open` scenario was judged
        for (const entry of catalog) {
            if (entry.channel !== 'statique' || !ROLE_REACH.has(entry.reach)) {
                continue;
            }
            const source = read(`lint/rules/${entry.facet}/${entry.name}.ts`);
            expect(
                source.includes('identityOf(') || source.includes('isTestRole('),
                `${entry.name} states reach \`${entry.reach}\` and reads no role`,
            ).toBe(true);
        }
    });

    test('conventions catalogue — completeness (meta-test) — every catalogue row names exactly ONE channel', () => {
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

    test('conventions catalogue — completeness (meta-test) — k12 — every catalogue row declares ONE audience', () => {
        // Given - the two audiences a rule can have
        const AUDIENCES = new Set(['consumer', 'self']);

        // Then - each row says whether a project using the package meets it, or only this package's own suite does
        for (const entry of catalog) {
            expect(AUDIENCES.has(entry.audience), `${entry.name} audience`).toBe(true);
        }
    });

    test('conventions catalogue — completeness (meta-test) — k12 — a row lives in the manifest of its audience', () => {
        // Given - the two manifests: the one the published code reads, and the one no published entry imports
        // Then - the published manifest holds consumer rows alone, the self manifest self rows alone, and together they are the whole catalogue
        expect(audiences(consumerCatalog)).toStrictEqual(['consumer']);
        expect(audiences(selfCatalog)).toStrictEqual(['self']);
        expect(consumerCatalog.length + selfCatalog.length).toBe(catalog.length);
    });

    test('conventions catalogue — completeness (meta-test) — every catalogue entry has a unique implementation name', () => {
        // Given - the assembled catalogue
        // Then - no two entries share a name (each maps to a distinct implementation)
        const names = new Set<string>();
        for (const entry of catalog) {
            expect(names.has(entry.name), `duplicate catalogue entry ${entry.name}`).toBeFalsy();
            names.add(entry.name);
        }
    });

    test('testing fragment — standalone oxlint config — is self-sufficient (no `extends` needed): plugin + every rule + the A4 override', () => {
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

    test('testing fragment — standalone oxlint config — declares no `categories` — every rule it ships is decided by name', () => {
        // Given - the fragment, top level and every override entry (the `categories` block in specs/shared/fixtures/lint-cli/oxlint.e2e.json is a test harness muting oxlint's own defaults, not a config this package ships)
        const layers: Record<string, unknown>[] = [
            testing as unknown as Record<string, unknown>,
            ...((testing.overrides ?? []) as unknown as Record<string, unknown>[]),
        ];

        // Then - none of them opens a category: a category turns on rules nobody decided, and composing it over a base preset silently re-enables them
        for (const layer of layers) {
            expect('categories' in layer).toBeFalsy();
        }
    });

    test('testing fragment — standalone oxlint config — the only `warn` levels are the advisory `w` channel', () => {
        // Given - each rule the fragment enables (its `rules` IS this map, above)
        for (const [id, level] of Object.entries(recommendedRules)) {
            // Then - `warn` belongs to the redundancy heuristics (`<family><n>w-…`) and nothing else; every hard convention is an error. The estate's rulebook has no warn tier — this package's `w` channel is its one documented exception (see the manifest's statique channel note)
            const advisory = /^jterrazz\/\w+w-/u.test(id);
            expect(level, `${id} is ${level}`).toBe(advisory ? 'warn' : 'error');
        }
    });

    test('testing fragment — standalone oxlint config — its overrides add a layer instead of replacing one', () => {
        // Given - each override entry of the fragment
        for (const entry of testing.overrides ?? []) {
            // Then - it is scoped by `files` and carries `rules` only, so a profile already holding its own overrides (v10 puts the `vitest` plugin on the test globs that way) keeps them: oxlint concatenates the arrays
            expect(entry.files.length).toBeGreaterThan(0);
            expect(Object.keys(entry).sort()).toStrictEqual(['files', 'rules']);
        }
    });

    test('conventions catalogue — the channels answer for themselves (meta-test) — k2 — a citation that resolves to nothing is caught, in every shape it takes', () => {
        // Given - one false id in each of the four citation shapes, beside a true one, and a false name beside a true one
        const ids = idsCitedIn("see rule C99, (C98 — gone), CONVENTIONS C97/C12, and C96's reach");
        const names = namesCitedIn('`c99-nothing-here` and `c12-spec-file-name`');

        // Then - exactly the false ones resolve to nothing
        expect(ids.filter((id) => !rowIds.has(id)).toSorted()).toStrictEqual([
            'C96',
            'C97',
            'C98',
            'C99',
        ]);
        expect(names.filter((name) => !knownNames().has(name))).toStrictEqual(['c99-nothing-here']);
    });

    test('conventions catalogue — the channels answer for themselves (meta-test) — k2 — every id the corpus cites resolves to a row', () => {
        // Given - every citation shape the corpus uses, in the chapters, the skill, the messages the plugin ships and the comments of the code that implements them. The families are the vocabulary: a citation is a family letter and a number, and nothing else is one
        const cited = new Map<string, string>();
        const collect = (text: string, where: string): void => {
            for (const id of idsCitedIn(text)) {
                cited.set(id, where);
            }
        };
        for (const file of [...citingFiles(), ...citingSources()]) {
            collect(read(file), file);
        }
        for (const [name, rule] of Object.entries(allRules)) {
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

    test('conventions catalogue — the channels answer for themselves (meta-test) — k2 — every rule NAME the corpus cites resolves to a rule or a pass', () => {
        // Given - every implementation name the corpus spells, in the chapters, the skill and the code. A retired rule leaves its name behind in an example a consumer copies, and oxlint refuses a config naming a rule it does not know — the whole file, not the line
        const names = knownNames();
        const cited = new Map<string, string>();
        for (const file of [...citingFiles(), ...citingSources()]) {
            for (const line of read(file).split('\n')) {
                // A migration sentence NAMES what it retired — that is what it
                // Is for, and a consumer's config still naming one is what it
                // Warns about. The names on that line are gone by design.
                if (line.includes('no longer exist')) {
                    continue;
                }
                for (const name of namesCitedIn(line)) {
                    cited.set(name, file);
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

    test('conventions catalogue — the channels answer for themselves (meta-test) — k4 — the reach fixture proves a rule of every reach the catalogue states', () => {
        // Given - the reaches the plugin's rows state, and the rules the reach meta-test reads off its one run
        const reachOf = new Map(
            Object.entries(plugin.rules).map(([id, rule]) => [id, rule.meta?.docs?.reach]),
        );
        // A rule the run must NOT report on a path proves where it stops, not that it reaches.
        const named = [
            ...read('specs/lint/meta/k4-reach-per-path.test.ts')
                .replaceAll(/\.not\.toContain\(\s*'[^']*',?\s*\)/gu, '')
                .matchAll(/'(?<id>[a-z]\d+w?-[a-z0-9-]+)'/gu),
        ]
            .map((match) => match.groups?.id ?? '')
            .filter((id) => reachOf.has(id));

        // Then - each reach is judged there by at least one of its own rules
        expect(new Set(named.map((id) => reachOf.get(id)))).toStrictEqual(
            new Set(reachOf.values()),
        );
    });

    test('conventions catalogue — the channels answer for themselves (meta-test) — m1 — every constructor has a specs tree in this package', () => {
        // Given - the six constructors, and the trees this package specifies itself on
        const constructors = ['api', 'cli', 'integration', 'job', 'mobile', 'website'];
        const trees = new Set(readdirSync(resolve(ROOT, 'specs')));

        // Then - each has one, mobile included: its specs run against the Appium protocol double (docs/03)
        for (const facet of constructors) {
            expect(trees.has(facet), `${facet} has no specs tree`).toBe(true);
        }

        // Then - the seventh subject is held too: `component` is a chain rather than a constructor, so its tree is the fixture app its colocated `.test.tsx` files sit in
        expect(trees.has('component'), 'component has no fixture app tree').toBe(true);
        expect(
            readdirSync(resolve(ROOT, 'specs/component'), { recursive: true }).some((entry) =>
                String(entry).endsWith('.test.tsx'),
            ),
            'specs/component holds no rendered unit',
        ).toBe(true);
    });

    test('conventions catalogue — the channels answer for themselves (meta-test) — every channel answers for its rows the way the channel can', () => {
        // Given - the seven channels, each with the proof its rows owe
        const proofs: [
            string,
            (entry: { id: string; name: string; upstream?: string }) => boolean,
        ][] = [
            ['statique', (entry) => pluginRules.has(entry.name)],
            ['checker', (entry) => CHECKER_PASS_IDS.has(entry.name) || SELF_PASSES.has(entry.name)],
            [
                // The row names the upstream rule it rests on, and the proof is
                // An assertion on THAT rule's resolved option — a file-level
                // Check passed for any row as long as one assertion existed.
                'upstream',
                (entry) =>
                    entry.upstream !== undefined &&
                    read('lint/plugin.test.ts').includes(`optionOf('${entry.upstream}')`),
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

    test('conventions catalogue — the channels answer for themselves (meta-test) — the four channels that are not code still carry their vocabulary', () => {
        // Given - the rows the manifest holds outside the two rule channels
        // Then - each names a family the catalogue publishes, so the generated chapter has a section to put it in
        const families = [...UPSTREAM_RULES, ...TYPE_ROWS, ...META_ROWS].map(
            (row) => FAMILIES[row.family] ?? `${row.name} names no family`,
        );
        expect(families.filter((title) => title.includes('names no family'))).toStrictEqual([]);
    });

    test('conventions catalogue — E2E inventory (meta-test) — every plugin rule is specified by documents over trees of its own', () => {
        // Given - each shipped rule
        for (const id of pluginRules) {
            // Then - its documents in specs/lint/<id>/, and the trees they lint beside them
            expect(withDocuments.has(id), `${id} has no documents in specs/lint/${id}/`).toBe(true);
            expect(
                existsSync(resolve(ROOT, 'specs/lint', id, 'fixtures')),
                `${id} has no fixtures/`,
            ).toBe(true);
        }
    });

    test('conventions catalogue — E2E inventory (meta-test) — every plugin rule has a document proving the line and column it fires on', () => {
        // Given - each shipped rule, and the report lines its documents golden
        for (const id of pluginRules) {
            const position = new RegExp(
                String.raw`^\s+\S+:\d+:\d+  ${namespaceOf(id)}\(${id}\)$`,
                'mu',
            );
            const proven = readdirSync(resolve(ROOT, 'specs/lint', id))
                .filter((entry) => entry.endsWith('.spec.yaml'))
                .some((entry) => position.test(read(`specs/lint/${id}/${entry}`)));

            // Then - one golden at least says WHERE the rule fired, not only that it did
            expect(proven, `${id} has no document whose golden names file:line:column`).toBe(true);
        }
    });

    test('conventions catalogue — E2E inventory (meta-test) — every checker pass has a specs/lint E2E spec that runs the built checker', () => {
        // Given - each pass dist/checker.js runs, tree and member alike, and each dist/self-checker.js runs
        for (const id of [...CHECKER_PASS_IDS, ...SELF_PASSES]) {
            // Then - its documents in specs/lint/<id>/, or its own test under specs/lint/checker/: a pass the registry names and no spec runs is a sentence with nothing behind it
            expect(
                withDocuments.has(id) ||
                    existsSync(resolve(ROOT, 'specs/lint/checker', `${id}.test.ts`)),
                `${id} has no E2E spec`,
            ).toBe(true);
        }
    });

    test('conventions catalogue — E2E inventory (meta-test) — every specs/lint E2E spec maps to a plugin rule or a checker pass', () => {
        // Given - each E2E spec id, and the meta rows that have a spec of their own
        const metaRows = new Set(META_ROWS.map((row) => row.name));
        for (const id of e2eSpecIds) {
            // Then - it is a shipped rule, a known checker pass, a meta row, or A CLI-contract probe
            expect(
                pluginRules.has(id) ||
                    CHECKER_PASS_IDS.has(id) ||
                    SELF_PASSES.has(id) ||
                    CLI_CONTRACT_SPECS.has(id) ||
                    metaRows.has(id),
                `${id} maps to no rule, pass, meta row, or CLI-contract spec`,
            ).toBeTruthy();
        }
    });

    test('conventions catalogue — E2E inventory (meta-test) — the reach config enables exactly the rules the standard one does', () => {
        // Given - the two standalone configs the lint E2E specs run with

        // Then - the reach fixture is judged by the SAME catalogue; only C1's declared depth differs, which is what the fixture is there to state
        expect(
            rulesOf('specs/shared/fixtures/lint-cli/oxlint.reach.json').toSorted(),
        ).toStrictEqual(rulesOf('specs/shared/fixtures/lint-cli/oxlint.e2e.json').toSorted());
    });

    test('conventions catalogue — E2E inventory (meta-test) — the E2E lint config (oxlint.e2e.json) enables exactly the shipped rule set', () => {
        // Given - the standalone oxlint config the checker E2E specs lint their violation fixtures with
        const config = JSON.parse(read('specs/shared/fixtures/lint-cli/oxlint.e2e.json')) as {
            rules: Record<string, unknown>;
        };

        // Then - its rule keys match recommendedRules and the self rules exactly: no rule runs without an E2E lint pass, and no stale rule lingers in the fixture config
        expect(Object.keys(config.rules).toSorted()).toStrictEqual(
            Object.keys({ ...recommendedRules, ...selfRules }).toSorted(),
        );
    });

    test('conventions catalogue — E2E inventory (meta-test) — the docs/15 token table matches TOKEN_KINDS exactly', () => {
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

    test('the corpus’ own coordinates (meta-test K8) — k8 — every relative link lands on a file, and every anchor on a heading', () => {
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

    test('the corpus’ own coordinates (meta-test K8) — k8 — every `docs/NN` the source cites names a chapter that exists', () => {
        // Given - the chapter numbers the corpus actually has, and every one the source names — a test TITLE and a comment cite chapters too, and a renumbering moves the files while leaving those behind
        const chapters = new Set(
            readdirSync(resolve(ROOT, 'docs'))
                .map((entry) => /^(?<number>\d{2})-/u.exec(entry)?.groups?.number)
                .filter((number) => number !== undefined),
        );
        const cited: string[] = [];
        for (const entry of readdirSync(resolve(ROOT, 'src'), { recursive: true })) {
            const path = `src/${String(entry).replaceAll('\\', '/')}`;
            if (!/\.tsx?$/u.test(path)) {
                continue;
            }
            for (const hit of readFileSync(resolve(ROOT, path), 'utf8').matchAll(
                /\bdocs\/(?<number>\d{2})\b/gu,
            )) {
                const number = hit.groups?.number ?? '';
                if (!chapters.has(number)) {
                    cited.push(`${path} -> docs/${number}`);
                }
            }
        }

        // Then - no citation points at a chapter number the renumbering left empty
        expect(chapters.size).toBeGreaterThan(15);
        expect(
            cited,
            'a chapter number the source cites and the corpus does not have',
        ).toStrictEqual([]);
    });

    test('the corpus never offers an option the rulebook refuses — no page restores the all-caps title exemption with `allowedPrefixes`', () => {
        // Given - every page, and the option WRITTEN AS A SETTING (a key, not the word): the rulebook sets no `allowedPrefixes`, so a chapter offering one sends a consumer to a config oxlint rejects, and naming it in prose to say it does not exist has to stay legal
        const swept = pages();
        const claimed = swept.filter((path) =>
            /allowedPrefixes["']?\s*:/u.test(readFileSync(resolve(ROOT, path), 'utf8')),
        );

        // Then - a title opening on an identifier is renamed, or deviated on in the consumer's own fragment
        expect(swept.length).toBeGreaterThan(20);
        expect(claimed, 'a page offering `allowedPrefixes` as a setting').toStrictEqual([]);
    });

    test('the ./oxlint entry publishes what test material is — both builds answer materialAt and testPackageOf, typed from the published declarations', () => {
        // Given - the entry as a consumer imports it, and its CommonJS build (`npm run build` first)
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- `require` answers `any`: the ESM build's published types are the shape the CJS build must carry
        const cjs: MaterialReaders = createRequire(import.meta.url)('@jterrazz/test/oxlint');

        // Then - each build reads a module id and a specifier as the F2 guard does
        const answers = [
            'a test file',
            'the specs tree',
            'the specs tree',
            undefined,
            'vitest',
            '@testing-library/react',
            undefined,
            undefined,
        ];
        expect(answersOf({ materialAt, testPackageOf })).toStrictEqual(answers);
        expect(answersOf(cjs)).toStrictEqual(answers);
    });
});
