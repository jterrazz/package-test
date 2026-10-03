import { lessonParts } from '@jterrazz/typescript/rules';
import { describe, expect, test } from 'vitest';

import { RUNTIME_RULES } from '../../../src/chain/refusals/rows.js';
import { consumerRows, PROCESS_RULES } from '../../consumer/catalogue/manifest.js';
import plugin from '../../index.oxlint.js';
import { CATALOGUE_CHAPTER } from '../../kit/catalogue/chapter.js';
import { SELF_FAMILIES } from '../catalogue/families.js';
import { allRows, SELF_CHAPTER, SELF_PROCESS_RULES, selfRows } from '../catalogue/manifest.js';
import selfPlugin from '../rules/plugin.js';
import {
    allRules,
    audiences,
    carries,
    CHECKER_PASS_IDS,
    checkerRowsOf,
    read,
    ruleFileOf,
    SELF_PASSES,
    STATIC_ROWS,
    staticRowsOf,
} from './catalogue-rows.js';

const everyRow = [...allRows, ...RUNTIME_RULES];

describe('catalogue-rows', () => {
    test('catalogueRows — conventions catalogue — completeness (meta-test) — every shipped plugin rule carries a static meta.docs entry', () => {
        // Given - each rule of either plugin, and the manifest read by rule id
        const docsById = new Map(STATIC_ROWS.map((row) => [row.name, row]));
        const rules = Object.entries(allRules);
        expect(rules.length).toBeGreaterThan(0);

        // Then - it attaches its manifest doc as meta.docs, on the static channel
        expect(
            rules
                .filter(
                    ([id, rule]) =>
                        rule.meta?.docs === undefined ||
                        rule.meta.docs !== docsById.get(id) ||
                        rule.meta.docs.channel !== 'static',
                )
                .map(([id]) => id),
        ).toStrictEqual([]);
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — the static docs cover exactly the rules of the plugin their audience loads', () => {
        // Given - the static docs, split by audience, and the two plugin maps
        // Then - a consumer row is a rule of the published plugin, a self row one of the self plugin, and neither plugin registers a rule of the other audience
        expect(staticRowsOf('consumer')).toStrictEqual(Object.keys(plugin.rules).toSorted());
        expect(staticRowsOf('self')).toStrictEqual(Object.keys(selfPlugin.rules).toSorted());
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — every checker-channel manifest entry maps to a pass of the checker its audience runs', () => {
        // Given - the checker channel of the manifest, split by audience
        // Then - a consumer row names a pass dist/checker.js runs, a self row one `.artifacts/dev/self.js check` runs, and neither checker runs a pass of the other audience
        expect(checkerRowsOf('consumer')).toStrictEqual([...CHECKER_PASS_IDS].toSorted());
        expect(checkerRowsOf('self')).toStrictEqual([...SELF_PASSES].toSorted());
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — runtime and process manifest entries are documented (convention + rationale)', () => {
        // Given - the review-borne / execution-time channels
        const entries = [...RUNTIME_RULES, ...PROCESS_RULES, ...SELF_PROCESS_RULES];
        expect(entries.length).toBeGreaterThan(0);

        // Then - each carries non-empty normative text and a rationale (its "implementation" is the framework runtime or human review — documented here, not a lint rule)
        expect(
            entries
                .filter((entry) => entry.sentence.length === 0 || entry.rationale.length === 0)
                .map((entry) => entry.name),
        ).toStrictEqual([]);
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — `catalogue-in-english` — no catalogue sentence has gone back to French', () => {
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
            'statique',
            'toute',
            'une spec',
        ];

        // Then - every sentence and channel name the catalogue publishes is English
        const texts = [
            ...everyRow.map((entry) => ({
                text: `${entry.channel} ${entry.sentence} ${entry.rationale} ${entry.fix}`,
                where: entry.name,
            })),
            ...Object.entries(SELF_FAMILIES).map(([family, title]) => ({
                text: title,
                where: `family ${family}`,
            })),
        ];
        expect(
            texts.flatMap(({ text, where }) =>
                FRENCH.filter((token) => carries(text, token)).map(
                    (token) => `${where} carries the French token "${token}"`,
                ),
            ),
        ).toStrictEqual([]);
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — `message-reads-its-row` — every diagnostic reads at its own row, on a heading that exists', () => {
        // Given - the rules of both plugins, whose messages carry a generated `read:` part, and the chapter each audience's rows live in
        const rules = Object.entries(allRules);
        expect(rules.length).toBeGreaterThan(0);

        // Then - each message routes to its own row's heading, in its audience's chapter, and the heading EXISTS there
        expect(
            rules.flatMap(([name, rule]) => {
                const chapter =
                    rule.meta.docs.audience === 'self' ? SELF_CHAPTER : CATALOGUE_CHAPTER;
                return Object.entries(rule.meta?.messages ?? {})
                    .filter(([, message]) => lessonParts(message)?.read !== `${chapter}#${name}`)
                    .map(([key]) => `${name}.${key} reads elsewhere`)
                    .concat(
                        read(chapter).includes(`<a id="${name}"></a>`)
                            ? []
                            : [`${chapter} holds no heading for ${name}`],
                    );
            }),
        ).toStrictEqual([]);
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — every catalogue row states its reach and its fix', () => {
        // Given - the assembled catalogue
        expect(everyRow.length).toBeGreaterThan(0);

        // Then - a reader deciding whether a rule applies to the file in front of them never has to read its implementation
        expect(
            everyRow
                .filter((entry) => entry.reach.length === 0 || entry.fix.length === 0)
                .map((entry) => entry.name),
        ).toStrictEqual([]);
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — a static row that states a role gate has one', () => {
        // Given - every static row whose reach is one KIND of file — `tests` and `all` are out, because a rule gated on a SHAPE (a `.fixture()` literal, a `.trigger()` name) looks at every file and finds that shape only in a test, which is what its convention says
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
        const gated = everyRow.filter(
            (entry) => entry.channel === 'static' && ROLE_REACH.has(entry.reach),
        );
        expect(gated.length).toBeGreaterThan(0);
        expect(
            gated
                .filter((entry) => {
                    const source = read(ruleFileOf(entry));
                    return !source.includes('identityOf(') && !source.includes('isTestRole(');
                })
                .map((entry) => `${entry.name} states reach \`${entry.reach}\` and reads no role`),
        ).toStrictEqual([]);
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — every catalogue row names exactly ONE channel', () => {
        // Given - the eight-channel vocabulary
        const CHANNELS = new Set([
            'checker',
            'meta',
            'process',
            'runtime',
            'static',
            'toolchain',
            'type',
            'upstream',
        ]);

        // Then - each row says which pass a reader should expect its finding from
        expect(
            everyRow.filter((entry) => !CHANNELS.has(entry.channel)).map((entry) => entry.name),
        ).toStrictEqual([]);
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — `rule-declares-its-audience` — every catalogue row declares ONE audience', () => {
        // Given - the two audiences a rule can have
        const AUDIENCES = new Set(['consumer', 'self']);

        // Then - each row says whether a project using the package meets it, or only this package's own suite does
        expect(
            everyRow.filter((entry) => !AUDIENCES.has(entry.audience)).map((entry) => entry.name),
        ).toStrictEqual([]);
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — `rule-declares-its-audience` — a row lives in the manifest of its audience', () => {
        // Given - the two manifests: the one the published code reads, and the one no published entry imports
        // Then - the published manifest holds consumer rows alone, the self manifest self rows alone, and together they are the whole catalogue
        expect(audiences(consumerRows)).toStrictEqual(['consumer']);
        expect(audiences(selfRows)).toStrictEqual(['self']);
        expect(consumerRows.length + selfRows.length).toBe(allRows.length);
    });

    test('catalogueRows — conventions catalogue — completeness (meta-test) — every catalogue entry has a unique implementation name', () => {
        // Given - the assembled catalogue
        // Then - no two entries share a name (each maps to a distinct implementation)
        const names = everyRow.map((entry) => entry.name);
        expect(names.filter((name, index) => names.indexOf(name) !== index)).toStrictEqual([]);
    });
});
