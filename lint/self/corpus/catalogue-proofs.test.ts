import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { RUNTIME_RULES } from '../../../src/chain/refusals/rows.js';
import { FAMILIES } from '../../consumer/catalogue/families.js';
import { TYPE_ROWS, UPSTREAM_RULES } from '../../consumer/catalogue/manifest.js';
import plugin from '../../index.oxlint.js';
import { TOKEN_KINDS } from '../../kit/project/tokens.js';
import { SELF_FAMILIES } from '../catalogue/families.js';
import { allRows, META_ROWS } from '../catalogue/manifest.js';
import {
    allRules,
    CHECKER_PASS_IDS,
    citingFiles,
    citingSources,
    CLI_CONTRACT_SPECS,
    e2eSpecIdsOf,
    FACET_CONTRACT_SPECS,
    handedToTheToolchain,
    humanWords,
    idsCitedIn,
    lintSpecEntries,
    metaProofs,
    namespaceOf,
    pluginRules,
    read,
    ROOT,
    runtimeMarkers,
    SELF_PASSES,
    specsOf,
    TOOLCHAIN_ROWS,
    withSpecsOf,
} from './catalogue-proofs.js';

const everyRow = [...allRows, ...RUNTIME_RULES];

const knownNames = (): Set<string> =>
    new Set([
        ...pluginRules,
        ...CHECKER_PASS_IDS,
        ...SELF_PASSES,
        ...everyRow.map((entry) => entry.name),
    ]);

const SPECS_LINT = resolve(ROOT, 'specs/lint');

const lintSpecs = lintSpecEntries(SPECS_LINT);

const withSpecs = withSpecsOf(lintSpecs);

const e2eSpecIds = e2eSpecIdsOf(lintSpecs);

describe('catalogue-proofs', () => {
    test('catalogueProofs — conventions catalogue — the channels answer for themselves (meta-test) — `cited-rules-exist` — a citation that resolves to nothing is caught, in every shape it takes', () => {
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

    test('catalogueProofs — conventions catalogue — the channels answer for themselves (meta-test) — `cited-rules-exist` — every rule the corpus cites resolves to a row', () => {
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
        expect(
            [...cited]
                .filter(([id]) => !names.has(id))
                .map(([id, where]) => `${where} cites rule ${id}, which resolves to no row`),
        ).toStrictEqual([]);
    });

    test('catalogueProofs — conventions catalogue — the channels answer for themselves (meta-test) — `every-reach-proven` — the reach fixture proves a rule of every reach the catalogue states', () => {
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

    test('catalogueProofs — conventions catalogue — the channels answer for themselves (meta-test) — `every-constructor-has-specs` — every constructor has a specs tree in this package', () => {
        // Given - the seven constructors, and the trees this package specifies itself on
        const constructors = ['api', 'cli', 'integration', 'job', 'lint', 'mobile', 'website'];
        const trees = new Set(readdirSync(resolve(ROOT, 'specs')));

        // Then - each has one, mobile included: its specs run against the Appium protocol double (docs/03); and the eighth subject is held too: `component` is a chain rather than a constructor, so its tree is the fixture app its colocated `.test.tsx` files sit in
        expect([...constructors, 'component'].filter((facet) => !trees.has(facet))).toStrictEqual(
            [],
        );
        expect(
            readdirSync(resolve(ROOT, 'specs/component'), { recursive: true }).some((entry) =>
                String(entry).endsWith('.test.tsx'),
            ),
            'specs/component holds no rendered unit',
        ).toBe(true);
    });

    test('catalogueProofs — conventions catalogue — the channels answer for themselves (meta-test) — every channel answers for its rows the way the channel can', () => {
        // Given - the eight channels, each with the proof its rows owe
        const proofs: [
            string,
            (entry: { audience?: string; name: string; upstream?: string }) => boolean,
        ][] = [
            ['static', (entry) => pluginRules.has(entry.name)],
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
                        read('specs/cli/tsc/_fixtures/consumer/consumer.ts').includes(marker),
                    ),
            ],
            ['runtime', (entry) => runtimeMarkers().has(entry.name)],
            ['meta', (entry) => metaProofs(SPECS_LINT).has(entry.name)],
            ['process', (entry) => humanWords(entry).includes(`\`${entry.name}\``)],
        ];

        // Then - every channel has rows, and no row of any channel is a sentence with nothing behind it
        expect(
            proofs.flatMap(([channel, proven]) => {
                const rows = everyRow.filter((entry) => entry.channel === channel);
                return rows.length === 0
                    ? [`${channel} has no rows`]
                    : rows
                          .filter((row) => !proven(row))
                          .map((row) => `${row.name} (${channel}) has no proof`);
            }),
        ).toStrictEqual([]);
    });

    test('catalogueProofs — conventions catalogue — the channels answer for themselves (meta-test) — the four channels that are not code still carry their vocabulary', () => {
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

    test('catalogueProofs — conventions catalogue — E2E inventory (meta-test) — every plugin rule is specified on the lint facet over trees of its own', () => {
        // Given - each shipped rule
        expect(pluginRules.size).toBeGreaterThan(0);

        // Then - its specs in specs/lint/<id>/, and the trees they lint beside them
        expect(
            [...pluginRules].flatMap((id) =>
                [
                    withSpecs.has(id) ? null : `${id} has no spec in specs/lint/${id}/`,
                    existsSync(resolve(ROOT, 'specs/lint', id, '_fixtures'))
                        ? null
                        : `${id} has no _fixtures/`,
                ].filter((broken) => broken !== null),
            ),
        ).toStrictEqual([]);
    });

    test('catalogueProofs — conventions catalogue — E2E inventory (meta-test) — every plugin rule has a spec proving the line and column it fires on', () => {
        // Given - each shipped rule, and the reports its specs golden
        expect(pluginRules.size).toBeGreaterThan(0);

        // Then - one golden at least says WHERE the rule fired, not only that it did
        expect(
            [...pluginRules].filter((id) => {
                const position = new RegExp(
                    String.raw`^\s+\S+:\d+:\d+  ${namespaceOf(id)}\(${id}\)$`,
                    'mu',
                );
                return !specsOf(lintSpecs, id).some((entry) =>
                    position.test(read(`specs/lint/${entry}`)),
                );
            }),
        ).toStrictEqual([]);
    });

    test('catalogueProofs — conventions catalogue — E2E inventory (meta-test) — every checker pass has a specs/lint E2E spec that runs the built checker', () => {
        // Given - each pass dist/checker.js runs, tree and member alike, and each `.artifacts/dev/self.js check` runs
        const passes = [...CHECKER_PASS_IDS, ...SELF_PASSES];
        expect(passes.length).toBeGreaterThan(0);

        // Then - its specs in specs/lint/<id>/: a pass the registry names and no spec runs is a sentence with nothing behind it
        expect(passes.filter((id) => !withSpecs.has(id))).toStrictEqual([]);
    });

    test('catalogueProofs — conventions catalogue — E2E inventory (meta-test) — every specs/lint E2E spec maps to a plugin rule or a checker pass', () => {
        // Given - each E2E spec id, and the meta rows that have a spec of their own
        const metaRows = new Set(META_ROWS.map((row) => row.name));
        expect(e2eSpecIds.size).toBeGreaterThan(0);

        // Then - it is a shipped rule, a known checker pass, a rule handed to the toolchain, a meta row, a CLI-contract probe or the lint facet's own contract
        expect(
            [...e2eSpecIds].filter(
                (id) =>
                    !pluginRules.has(id) &&
                    !CHECKER_PASS_IDS.has(id) &&
                    !SELF_PASSES.has(id) &&
                    !TOOLCHAIN_ROWS.has(id) &&
                    !CLI_CONTRACT_SPECS.has(id) &&
                    !FACET_CONTRACT_SPECS.has(id) &&
                    !metaRows.has(id),
            ),
        ).toStrictEqual([]);
    });

    test('catalogueProofs — conventions catalogue — E2E inventory (meta-test) — the docs/22 token table matches TOKEN_KINDS exactly', () => {
        // Given - the token reference table's first-column cells (`| `{{kind}}` |`)
        const documented = new Set(
            read('docs/22-tokens.md')
                .split('\n')
                .map((line) => /^\|\s*`\{\{(?<kind>[a-z0-9]+)\}\}`\s*\|/u.exec(line)?.groups?.kind)
                .filter((kind): kind is string => kind !== undefined),
        );

        // Then - identical to the frozen vocabulary
        expect([...documented].toSorted()).toStrictEqual([...TOKEN_KINDS].toSorted());
    });
});
