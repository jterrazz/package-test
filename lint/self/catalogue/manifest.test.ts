import { anchor, anchorsOf, lessonParts, spliceBetween } from '@jterrazz/typescript/rules';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CATALOGUE_CHAPTER } from '../../consumer/catalogue/chapter.js';
import { FAMILIES } from '../../consumer/catalogue/families.js';
import { FORK_MARKERS, forkTable } from '../../consumer/catalogue/fork.js';
import {
    CHECKER_PASSES,
    consumerRows,
    PROCESS_RULES,
    RUNTIME_RULES,
    STATIQUE_RULES,
    TOOLCHAIN_RULES,
    TYPE_ROWS,
    UPSTREAM_RULES,
} from '../../consumer/catalogue/manifest.js';
import { CHECKER_PASS_IDS as CHECKER_PASS_REGISTRY } from '../../consumer/checks/checker.js';
import { testPreset } from '../../consumer/rulebook/preset.js';
import { TOKEN_KINDS } from '../../engine/project/tokens.js';
import plugin from '../../index.js';
import { SELF_CHECKER_PASS_IDS } from '../checks/checker.js';
import { sourceRootHoldsKnownEntries } from '../checks/source-root-holds-known-entries.js';
import { chapterAt } from '../index.js';
import selfPlugin from '../rules/plugin.js';
import { SELF_CHAPTER_MARKERS, selfChapterTable } from './chapter.js';
import { SELF_FAMILIES } from './families.js';
import {
    allRows,
    META_ROWS,
    SELF_CHAPTER,
    SELF_CHECKER_PASSES,
    SELF_PROCESS_RULES,
    SELF_STATIQUE_RULES,
    SELF_TOOLCHAIN_RULES,
    selfRows,
} from './manifest.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

const withoutGenerated = (text: string): string =>
    text.replaceAll(/<!-- GENERATED:[\s\S]*?<!-- \/GENERATED:[^>]*-->/gu, '');

const humanWords = (entry: { audience?: string }): string =>
    entry.audience === 'self'
        ? withoutGenerated(read('docs/03-testing.md'))
        : ((read('docs/18-conventions.md').split('## What stays human')[1] ?? '').split(
              '\n## ',
          )[0] ?? '');

const allRules = { ...plugin.rules, ...selfPlugin.rules };

function ruleFileOf(entry: { audience: string; family: string; name: string }): string {
    const rules = entry.audience === 'self' ? 'lint/self/rules' : 'lint/consumer/rules';
    return `${rules}/${entry.family}/${entry.name}.ts`;
}

const pluginRules = new Set(Object.keys(allRules));

function namespaceOf(id: string): string {
    return id in selfPlugin.rules ? 'jterrazz-self' : 'jterrazz';
}

const STATIQUE_ROWS = [...STATIQUE_RULES, ...SELF_STATIQUE_RULES];

function statiqueRowsOf(audience: string): string[] {
    return STATIQUE_ROWS.filter((row) => row.audience === audience)
        .map((row) => row.name)
        .toSorted();
}

/** A spec marks the runtime row it proves with `// RUNTIME <row name> — <the sentence>` above its test. */
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
            for (const match of read(path).matchAll(/\/\/ RUNTIME (?<id>[a-z][a-z-]+) —/gu)) {
                found.add(match.groups?.id ?? '');
            }
        }
    }
    return found;
}

function metaProofs(): Set<string> {
    const found = new Set<string>();
    const sources = [
        read('lint/self/catalogue/manifest.test.ts'),
        read('lint/self/corpus/architecture.test.ts'),
        read('lint/self/corpus/audience.test.ts'),
        read('lint/self/corpus/env-allowlist.test.ts'),
        read('lint/self/corpus/messages.test.ts'),
        read('lint/self/corpus/matrix.test.ts'),
        read('lint/self/corpus/port-readers.test.ts'),
        read('lint/self/corpus/positions.test.ts'),
        read('lint/self/corpus/siblings.test.ts'),
    ];
    for (const entry of readdirSync(resolve(ROOT, 'specs/lint'), { recursive: true })) {
        const path = String(entry).replaceAll('\\', '/');
        if (path.endsWith('.test.ts') && !path.includes('_fixtures/')) {
            sources.push(read(`specs/lint/${path}`));
        }
    }
    for (const row of META_ROWS) {
        if (sources.some((text) => text.includes(row.name))) {
            found.add(row.name);
        }
    }
    return found;
}

const CHECKER_PASS_IDS = new Set<string>(CHECKER_PASS_REGISTRY);

const TOOLCHAIN_ROWS = new Set(
    [...TOOLCHAIN_RULES, ...SELF_TOOLCHAIN_RULES].map((row) => row.name),
);

const handedToTheToolchain = new Set([
    ...(testPreset().layers ?? []).map(({ name }) => name),
    ...(testPreset().names ?? []).map(({ name }) => name),
    sourceRootHoldsKnownEntries.name,
]);

const SELF_PASSES = new Set<string>(SELF_CHECKER_PASS_IDS);

function audiences(rows: { audience: string }[]): string[] {
    return [...new Set(rows.map((row) => row.audience))];
}

function checkerRowsOf(audience: string): string[] {
    return [...CHECKER_PASSES, ...SELF_CHECKER_PASSES]
        .filter((entry) => entry.audience === audience)
        .map((entry) => entry.name)
        .toSorted();
}

/** Files probing the CLI boundary, plus the `output-asserted-as-a-golden` kitchen-sink, sit outside the rule↔fixture inventory. */
const CLI_CONTRACT_SPECS = new Set(['kitchen-sink']);

/** Whole words only: `qui` is inside "required", `est` inside "test". */
function carries(text: string, token: string): boolean {
    return new RegExp(String.raw`(?<![\p{L}'’])${token}(?![\p{L}'’])`, 'u').test(
        text.toLowerCase(),
    );
}

const citingFiles = (): string[] => {
    const found: string[] = [];
    for (const root of ['docs', 'skills']) {
        for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
            const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
            // A decision record is never edited: the ids it removed resolve to nothing by design.
            if (path.endsWith('.md') && !path.startsWith('docs/decisions/')) {
                found.push(path);
            }
        }
    }
    found.push('README.md');
    return found;
};

const DEAD_ID_INPUT =
    'specs/lint/checker-suppression-names-a-pass/_fixtures/checker-suppression-names-a-pass/';

/** Comments cite too. */
const citingSources = (): string[] => {
    const found: string[] = [];
    for (const root of ['src', 'specs']) {
        for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
            const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
            if (
                (path.endsWith('.ts') || path.endsWith('.tsx')) &&
                !path.startsWith(DEAD_ID_INPUT)
            ) {
                found.push(path);
            }
        }
    }
    return found;
};

const knownNames = (): Set<string> =>
    new Set([
        ...pluginRules,
        ...CHECKER_PASS_IDS,
        ...SELF_PASSES,
        ...allRows.map((entry) => entry.name),
    ]);

const NAME = String.raw`[a-z][a-z0-9]*(?:-[a-z0-9]+)*`;

const TICK = '`';

const CITED = `${TICK}${NAME}${TICK}`;

const citationPatterns = (): RegExp[] => [
    new RegExp(String.raw`\brules?\s+(${CITED}(?:\s*(?:,|and|or|/)\s*${CITED})*)`, 'gu'),
    new RegExp(String.raw`(?<![@\w./-])jterrazz(?:-self)?/(${NAME})(?![\w/-])`, 'gu'),
    new RegExp(String.raw`\bjterrazz(?:-self)?-check[(/](${NAME})`, 'gu'),
    new RegExp(
        String.raw`checker-disable(?:-next)?-line\s+((?:${NAME}|\*)(?:,\s*(?:${NAME}|\*))*)(?=\s+--|\s*$|${TICK})`,
        'giu',
    ),
];

const idsCitedIn = (line: string): string[] =>
    citationPatterns().flatMap((pattern) =>
        [...line.matchAll(pattern)].flatMap((match) =>
            (match[1] ?? '')
                .replaceAll('`', '')
                .split(/[\s,/]+/u)
                .filter((id) => !['', '*', 'and', 'or'].includes(id)),
        ),
    );

// A rule's specs in `specs/lint/<id>/`, on the lint facet; `meta/` holds the specs named for the meta row they prove.
const entries = readdirSync(resolve(ROOT, 'specs/lint'), { recursive: true }).map((entry) =>
    String(entry).replaceAll('\\', '/'),
);

const specsOf = (id: string): string[] =>
    entries.filter(
        (entry) => entry.startsWith(`${id}/`) && /^[^/]+\/[^/]+\.spec\.ts$/u.test(entry),
    );

const withSpecs = new Set(
    entries
        .filter((entry) => /^[a-z0-9-]+\/[^/]+\.spec\.ts$/u.test(entry))
        .map((entry) => entry.slice(0, entry.indexOf('/'))),
);

const e2eSpecIds = new Set([
    ...[...withSpecs].filter((id) => id !== 'meta'),
    ...specsOf('meta').map((entry) => entry.slice('meta/'.length, -'.spec.ts'.length)),
]);

/** Meta-test `links-resolve` — every relative link and heading anchor of the corpus resolves, generated pages included. */
type Coordinate = { fragment: string | undefined; from: string; target: string };

/** An absolute url is somebody else's. */
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

function pages(): string[] {
    const found: string[] = ['README.md', 'AGENTS.md'];
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

const landingOf = (coordinate: Coordinate): string => {
    const file = coordinate.target.split('#')[0];
    return file === undefined || file === ''
        ? resolve(ROOT, coordinate.from)
        : resolve(ROOT, coordinate.from, '..', file);
};

describe('manifest', () => {
    test('conventions catalogue — generation freshness (meta-test) — the docs/19 catalogue is byte-identical to a fresh generation', () => {
        // Given - the committed docs/19-linting.md
        const committed = read('docs/19-linting.md');

        // Then - re-splicing the generated catalogue changes nothing (run `npm run docs`)
        expect(chapterAt(ROOT, 'docs/19-linting.md', committed)).toBe(committed);
    });

    test('conventions catalogue — generation freshness (meta-test) — the fork table inside chapter 18 is byte-identical to a fresh splice', () => {
        // Given - the committed constitution
        const committed = readFileSync(resolve(ROOT, 'docs/18-conventions.md'), 'utf8');

        // Then - splicing a fresh table changes nothing
        expect(spliceBetween(committed, FORK_MARKERS, forkTable(), 'docs/18-conventions.md')).toBe(
            committed,
        );
    });

    test('conventions catalogue — generation freshness (meta-test) — the docs/03 table of the self rows is byte-identical to a fresh generation', () => {
        // Given - the committed docs/03-testing.md
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

        // Then - a consumer row is anchored in docs/19 alone, a self row in docs/03 alone: a consumer never reads a rule that holds only this package
        for (const entry of allRows) {
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
        const docsById = new Map(STATIQUE_ROWS.map((row) => [row.name, row]));
        for (const [id, rule] of Object.entries(allRules)) {
            // Then - it attaches its manifest doc as meta.docs (channel statique)
            expect(rule.meta?.docs, `rule ${id} is missing meta.docs`).toBeDefined();
            expect(rule.meta?.docs).toBe(docsById.get(id));
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
        // Then - a consumer row names a pass dist/checker.js runs, a self row one `dist/self.js check` runs, and neither checker runs a pass of the other audience
        expect(checkerRowsOf('consumer')).toStrictEqual([...CHECKER_PASS_IDS].toSorted());
        expect(checkerRowsOf('self')).toStrictEqual([...SELF_PASSES].toSorted());
    });

    test('conventions catalogue — completeness (meta-test) — runtime and process manifest entries are documented (convention + rationale)', () => {
        // Given - the review-borne / execution-time channels
        for (const entry of [...RUNTIME_RULES, ...PROCESS_RULES, ...SELF_PROCESS_RULES]) {
            // Then - each carries non-empty normative text and a rationale (its "implementation" is the framework runtime or human review — documented here, not a lint rule)
            expect(entry.sentence.length, `${entry.name} convention`).toBeGreaterThan(0);
            expect(entry.rationale.length, `${entry.name} rationale`).toBeGreaterThan(0);
        }
    });

    test('conventions catalogue — completeness (meta-test) — `catalogue-in-english` — no catalogue sentence has gone back to French', () => {
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
        for (const entry of allRows) {
            const sentences = `${entry.sentence} ${entry.rationale} ${entry.fix}`;
            for (const token of FRENCH) {
                expect(
                    carries(sentences, token),
                    `${entry.name} carries the French token "${token}"`,
                ).toBe(false);
            }
        }
        for (const [family, title] of Object.entries(SELF_FAMILIES)) {
            for (const token of FRENCH) {
                expect(
                    carries(title, token),
                    `family ${family} carries the French token "${token}"`,
                ).toBe(false);
            }
        }
    });

    test('conventions catalogue — completeness (meta-test) — `message-reads-its-row` — every diagnostic reads at its own row, on a heading that exists', () => {
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
        for (const entry of allRows) {
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

        // Then - its rule asks the file's role (`identityOf`, or the predicate that reads it): a row naming ONE kind while the implementation reads none is a sentence, and `test-id-states-what-is-missing` was one — any file with a `.visit/.render/.open` scenario was judged
        for (const entry of allRows) {
            if (entry.channel !== 'statique' || !ROLE_REACH.has(entry.reach)) {
                continue;
            }
            const source = read(ruleFileOf(entry));
            expect(
                source.includes('identityOf(') || source.includes('isTestRole('),
                `${entry.name} states reach \`${entry.reach}\` and reads no role`,
            ).toBe(true);
        }
    });

    test('conventions catalogue — completeness (meta-test) — every catalogue row names exactly ONE channel', () => {
        // Given - the eight-channel vocabulary
        const CHANNELS = new Set([
            'checker',
            'meta',
            'process',
            'runtime',
            'statique',
            'toolchain',
            'type',
            'upstream',
        ]);

        // Then - each row says which pass a reader should expect its finding from
        for (const entry of allRows) {
            expect(CHANNELS.has(entry.channel), `${entry.name} channel`).toBe(true);
        }
    });

    test('conventions catalogue — completeness (meta-test) — `rule-declares-its-audience` — every catalogue row declares ONE audience', () => {
        // Given - the two audiences a rule can have
        const AUDIENCES = new Set(['consumer', 'self']);

        // Then - each row says whether a project using the package meets it, or only this package's own suite does
        for (const entry of allRows) {
            expect(AUDIENCES.has(entry.audience), `${entry.name} audience`).toBe(true);
        }
    });

    test('conventions catalogue — completeness (meta-test) — `rule-declares-its-audience` — a row lives in the manifest of its audience', () => {
        // Given - the two manifests: the one the published code reads, and the one no published entry imports
        // Then - the published manifest holds consumer rows alone, the self manifest self rows alone, and together they are the whole catalogue
        expect(audiences(consumerRows)).toStrictEqual(['consumer']);
        expect(audiences(selfRows)).toStrictEqual(['self']);
        expect(consumerRows.length + selfRows.length).toBe(allRows.length);
    });

    test('conventions catalogue — completeness (meta-test) — every catalogue entry has a unique implementation name', () => {
        // Given - the assembled catalogue
        // Then - no two entries share a name (each maps to a distinct implementation)
        const names = new Set<string>();
        for (const entry of allRows) {
            expect(names.has(entry.name), `duplicate catalogue entry ${entry.name}`).toBe(false);
            names.add(entry.name);
        }
    });

    test('conventions catalogue — the channels answer for themselves (meta-test) — `cited-rules-exist` — a citation that resolves to nothing is caught, in every shape it takes', () => {
        // Given - a false name in each shape a rule is cited by, beside a true one
        const ids = [
            'see rule `gone-rule`, rules `no-sleep` and `lost-rule`,',
            '`jterrazz/unknown-rule`, `jterrazz-check(lost-pass)`, @jterrazz/test',
            '// checker-disable-next-line no-sleep, stale-pass -- a reason',
        ].flatMap(idsCitedIn);
        const unresolved = new Set(ids.filter((id) => !knownNames().has(id)));

        // Then - exactly the false ones resolve to nothing
        expect([...unresolved].toSorted()).toStrictEqual([
            'gone-rule',
            'lost-pass',
            'lost-rule',
            'stale-pass',
            'unknown-rule',
        ]);
    });

    test('conventions catalogue — the channels answer for themselves (meta-test) — `cited-rules-exist` — every rule the corpus cites resolves to a row', () => {
        // Given - every citation the corpus writes, in the chapters, the skill, the messages the plugin ships and the code that implements them. A rule no row declares leaves its name behind in an example a consumer copies, and oxlint refuses a config naming a rule it does not know — the whole file, not the line
        const cited = new Map<string, string>();
        const collect = (text: string, where: string): void => {
            for (const line of text.split('\n')) {
                for (const id of idsCitedIn(line)) {
                    cited.set(id, where);
                }
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
        const names = knownNames();
        expect(cited.size).toBeGreaterThan(0);
        for (const [id, where] of cited) {
            expect(names.has(id), `${where} cites rule ${id}, which resolves to no row`).toBe(true);
        }
    });

    test('conventions catalogue — the channels answer for themselves (meta-test) — `every-reach-proven` — the reach fixture proves a rule of every reach the catalogue states', () => {
        // Given - the reaches the plugin's rows state, and the rules the reach meta-test reads off its one run
        const reachOf = new Map(
            Object.entries(plugin.rules).map(([id, rule]) => [id, rule.meta?.docs?.reach]),
        );
        const named = [
            ...read('specs/lint/meta/every-reach-proven.spec.ts')
                .replaceAll(/\.not\.toContain\(\s*'[^']*',?\s*\)/gu, '')
                .matchAll(/'(?<id>[a-z][a-z0-9-]+)'/gu),
        ]
            .map((match) => match.groups?.id ?? '')
            .filter((id) => reachOf.has(id));

        // Then - each reach is judged there by at least one of its own rules
        expect(new Set(named.map((id) => reachOf.get(id)))).toStrictEqual(
            new Set(reachOf.values()),
        );
    });

    test('conventions catalogue — the channels answer for themselves (meta-test) — `every-constructor-has-specs` — every constructor has a specs tree in this package', () => {
        // Given - the seven constructors, and the trees this package specifies itself on
        const constructors = ['api', 'cli', 'integration', 'job', 'lint', 'mobile', 'website'];
        const trees = new Set(readdirSync(resolve(ROOT, 'specs')));

        // Then - each has one, mobile included: its specs run against the Appium protocol double (docs/03)
        for (const facet of constructors) {
            expect(trees.has(facet), `${facet} has no specs tree`).toBe(true);
        }

        // Then - the eighth subject is held too: `component` is a chain rather than a constructor, so its tree is the fixture app its colocated `.test.tsx` files sit in
        expect(trees.has('component'), 'component has no fixture app tree').toBe(true);
        expect(
            readdirSync(resolve(ROOT, 'specs/component'), { recursive: true }).some((entry) =>
                String(entry).endsWith('.test.tsx'),
            ),
            'specs/component holds no rendered unit',
        ).toBe(true);
    });

    test('conventions catalogue — the channels answer for themselves (meta-test) — every channel answers for its rows the way the channel can', () => {
        // Given - the eight channels, each with the proof its rows owe
        const proofs: [
            string,
            (entry: { audience?: string; name: string; upstream?: string }) => boolean,
        ][] = [
            ['statique', (entry) => pluginRules.has(entry.name)],
            [
                'toolchain',
                (entry) =>
                    [...handedToTheToolchain].some(
                        (name) => name === entry.name || name.startsWith(`${entry.name}-`),
                    ),
            ],
            ['checker', (entry) => CHECKER_PASS_IDS.has(entry.name) || SELF_PASSES.has(entry.name)],
            [
                'upstream',
                (entry) =>
                    entry.upstream !== undefined &&
                    read('lint/consumer/rulebook/vitest.test.ts').includes(
                        `optionOf('${entry.upstream}')`,
                    ),
            ],
            [
                'type',
                (entry) =>
                    [`// ${entry.name} —`, `@ts-expect-error ${entry.name} —`].some((marker) =>
                        read('src/type-channel.test-d.ts').includes(marker),
                    ),
            ],
            ['runtime', (entry) => runtimeMarkers().has(entry.name)],
            ['meta', (entry) => metaProofs().has(entry.name)],
            ['process', (entry) => humanWords(entry).includes(`\`${entry.name}\``)],
        ];

        // Then - no row of any channel is a sentence with nothing behind it
        for (const [channel, proven] of proofs) {
            const rows = allRows.filter((entry) => entry.channel === channel);
            expect(rows.length, `${channel} has no rows`).toBeGreaterThan(0);
            for (const row of rows) {
                expect(proven(row), `${row.name} (${channel}) has no proof`).toBe(true);
            }
        }
    });

    test('conventions catalogue — the channels answer for themselves (meta-test) — the four channels that are not code still carry their vocabulary', () => {
        // Given - the rows the manifest holds outside the two rule channels
        // Then - each names a family the catalogue publishes, so the generated chapter has a section to put it in
        const families = [
            ...[...UPSTREAM_RULES, ...TYPE_ROWS].map(
                (row) => FAMILIES[row.family] ?? `${row.name} names no family`,
            ),
            ...META_ROWS.map((row) => SELF_FAMILIES[row.family] ?? `${row.name} names no family`),
        ];
        expect(families.filter((title) => title.includes('names no family'))).toStrictEqual([]);
    });

    test('conventions catalogue — E2E inventory (meta-test) — every plugin rule is specified on the lint facet over trees of its own', () => {
        // Given - each shipped rule
        for (const id of pluginRules) {
            // Then - its specs in specs/lint/<id>/, and the trees they lint beside them
            expect(withSpecs.has(id), `${id} has no spec in specs/lint/${id}/`).toBe(true);
            expect(
                existsSync(resolve(ROOT, 'specs/lint', id, '_fixtures')),
                `${id} has no _fixtures/`,
            ).toBe(true);
        }
    });

    test('conventions catalogue — E2E inventory (meta-test) — every plugin rule has a spec proving the line and column it fires on', () => {
        // Given - each shipped rule, and the reports its specs golden
        for (const id of pluginRules) {
            const position = new RegExp(
                String.raw`^\s+\S+:\d+:\d+  ${namespaceOf(id)}\(${id}\)$`,
                'mu',
            );
            const proven = specsOf(id).some((entry) => position.test(read(`specs/lint/${entry}`)));

            // Then - one golden at least says WHERE the rule fired, not only that it did
            expect(proven, `${id} has no spec whose report names file:line:column`).toBe(true);
        }
    });

    test('conventions catalogue — E2E inventory (meta-test) — every checker pass has a specs/lint E2E spec that runs the built checker', () => {
        // Given - each pass dist/checker.js runs, tree and member alike, and each `dist/self.js check` runs
        for (const id of [...CHECKER_PASS_IDS, ...SELF_PASSES]) {
            // Then - its specs in specs/lint/<id>/: a pass the registry names and no spec runs is a sentence with nothing behind it
            expect(withSpecs.has(id), `${id} has no E2E spec`).toBe(true);
        }
    });

    test('conventions catalogue — E2E inventory (meta-test) — every specs/lint E2E spec maps to a plugin rule or a checker pass', () => {
        // Given - each E2E spec id, and the meta rows that have a spec of their own
        const metaRows = new Set(META_ROWS.map((row) => row.name));
        for (const id of e2eSpecIds) {
            // Then - it is a shipped rule, a known checker pass, a rule handed to the toolchain, a meta row, or A CLI-contract probe
            expect(
                pluginRules.has(id) ||
                    CHECKER_PASS_IDS.has(id) ||
                    SELF_PASSES.has(id) ||
                    TOOLCHAIN_ROWS.has(id) ||
                    CLI_CONTRACT_SPECS.has(id) ||
                    metaRows.has(id),
                `${id} maps to no rule, pass, toolchain row, meta row, or CLI-contract spec`,
            ).toBe(true);
        }
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

    test('conventions catalogue — the corpus’ own coordinates (meta-test) — `links-resolve` — every relative link lands on a file, and every anchor on a heading', () => {
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

    test('conventions catalogue — the corpus’ own coordinates (meta-test) — `links-resolve` — every `docs/NN` the source cites names a chapter that exists', () => {
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
