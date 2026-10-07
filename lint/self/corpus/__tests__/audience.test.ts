import { filesUnder } from '@jterrazz/typescript/rules';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { REFUSAL_WHY, RUNTIME_RULES } from '../../../../src/chain/refusals/rows.js';
import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { recordAt, stringsAt } from '../../../kit/project/json-shape.js';
import { allRows, SELF_CHECKER_PASSES, selfRows } from '../../catalogue/manifest.js';
import {
    danglingImports,
    extractTarball,
    MODULE_FILE,
    selfExposures,
    selfMentions,
    strandedBundles,
} from '../audience.js';

/** `rule-declares-its-audience` (meta-test) — a rule only this package is held to never reaches a consumer: the tarball is packed and extracted as an install holds it, so `npm run build` comes first. */
const ROOT = resolve(import.meta.dirname, '../../../..');

const TOOLCHAIN_CHECKER = join(ROOT, 'node_modules/@jterrazz/typescript/dist/checker.js');

type Manifest = {
    imports: Record<string, string>;
    exports: Record<string, unknown>;
};

function manifestOf(dir: string): Manifest {
    const manifest: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return { exports: recordAt(manifest, 'exports'), imports: stringsAt(manifest, 'imports') };
}

type PublishedEntry = {
    condition: string;
    subpath: string;
    target: string;
};

/** Every file the exports map resolves to, less what carries no code (a `types` target, a JSON schema). */
function publishedEntries(exports: Record<string, unknown>): PublishedEntry[] {
    const entries: PublishedEntry[] = [];
    const visit = (subpath: string, condition: string, node: unknown): void => {
        if (typeof node === 'string') {
            if (condition !== 'types' && !node.endsWith('.json')) {
                entries.push({ condition, subpath, target: node.replace(/^\.\//u, '') });
            }
            return;
        }
        if (typeof node === 'object' && node !== null) {
            for (const [key, child] of Object.entries(node)) {
                visit(subpath, key === 'default' ? condition : key, child);
            }
        }
    };
    for (const [subpath, node] of Object.entries(exports)) {
        visit(subpath, 'default', node);
    }
    return entries;
}

const PUBLISHED_CHANNELS = new Set(['runtime', 'type', 'upstream']);

describe('audience', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'audience-tarball-'));
    const installed = extractTarball(ROOT, scratch);
    const packed = new Set(filesUnder(installed));
    const rows = selfRows;
    const self = new Set(selfRows.map((row) => row.name));

    test('no byte the tarball carries names a self rule', () => {
        // Given - every file of the extracted tarball, read as text: bundles, chunks, types, pages, manifest
        const mentions = [...packed].flatMap((path) =>
            selfMentions(readFileSync(join(installed, path), 'utf8'), rows).map(
                (token) => `${path}: ${token}`,
            ),
        );

        // Then - no self rule's name, nor the plugin that registers one, is in any of it
        expect(packed.has('package.json')).toBe(true);
        expect(mentions).toStrictEqual([]);
    });

    test('a text is found naming a self rule by its name, or its plugin', () => {
        // Given - one text per way of naming a row, and one that only starts like a name
        const [row] = rows;
        const named = row === undefined ? [] : [`${row.name} runs`];

        // Then - each is found, and a longer name sharing a prefix is not the row's
        expect(named.map((text) => selfMentions(text, rows).length > 0)).toStrictEqual([true]);
        expect(selfMentions('"jterrazz-self/x": "error"', rows)).toContain('jterrazz-self');
        expect(
            selfMentions('links-resolve-twice holds', [{ name: 'links-resolve' }]),
        ).toStrictEqual([]);
    });

    test('no packed chunk is one only an unpacked bundle loads, nor imports one the tarball lacks', () => {
        // Given - the bundles the build writes, and the paths the tarball holds
        // Then - what the bundler split out of the unshipped entries stays home with them, and every packed bundle loads from the tarball alone
        expect(strandedBundles(ROOT, packed)).toStrictEqual([]);
        expect(danglingImports(installed, packed)).toStrictEqual([]);
    });

    test('the walk finds a self rule wherever an export nests it', () => {
        // Given - a fragment that hides one of each kind at depth: a rule map in an override, a plugin name, a rule object, a rule keyed by its bare name
        const fragment = {
            testing: {
                jsPlugins: ['jterrazz-self/plugin'],
                overrides: [{ rules: { 'jterrazz/specification-is-a-composition': 'off' } }],
            },
            nested: [{ meta: { docs: { audience: 'self' } } }],
            plugin: { rules: { 'specimen-filed-by-capability': {} } },
        };

        // Then - each is answered at the path it was found
        expect(selfExposures(fragment, self, 'x')).toStrictEqual([
            'x.testing.jsPlugins.0 = jterrazz-self/plugin',
            'x.testing.overrides.0.rules.jterrazz/specification-is-a-composition',
            'x.nested.0 (meta.docs.audience: self)',
            'x.plugin.rules.specimen-filed-by-capability',
        ]);
    });

    // invariant: the entries are loaded with the file, never inside a test: a mutation run reads a module first loaded during a test as code the test ran, where this test only reads what it exports.
    const published = publishedEntries(manifestOf(installed).exports);
    const load = createRequire(join(installed, 'package.json'));
    const exposures = published
        .filter(({ condition, target }) => condition !== 'browser' && MODULE_FILE.test(target))
        .map(({ condition, subpath, target }) => {
            const loaded: unknown = load(join(installed, target));
            return selfExposures(loaded, self, `${subpath} (${condition})`);
        });

    test('no module the exports map publishes exposes a self rule, at any depth', () => {
        // Given - every published entry of the extracted package, loaded by node itself as an install loads it — `require` takes a CommonJS build and an ES module alike, `.js`, `.cjs` or `.mjs`; a target of any other kind fails before a load
        expect(published.map(({ condition, subpath }) => `${subpath}:${condition}`)).toStrictEqual(
            expect.arrayContaining([
                '.:import',
                '.:browser',
                './vitest:import',
                './oxlint:import',
                './oxlint:require',
            ]),
        );
        expect(published.filter(({ target }) => !MODULE_FILE.test(target))).toStrictEqual([]);

        // Then - every entry is a module node loads and is in the tarball, and no rule object, name nor rule map a consumer reaches is a self rule's — the browser build, which loads only inside Browser Mode, is held by the text above
        expect(published.filter(({ target }) => !packed.has(target))).toStrictEqual([]);
        expect(exposures.flat()).toStrictEqual([]);
    });

    test('no checks the tarball declares run a self pass, over the trees that trip each one', () => {
        // Given - every private entry of the extracted package, run as the toolchain runs a preset's checks, over every fixture a self pass's documents stand on
        const entries = Object.entries(manifestOf(installed).imports);
        const codes = SELF_CHECKER_PASSES.map(({ name }) => `jterrazz-check(${name})`);
        const trees = SELF_CHECKER_PASSES.flatMap(({ name }) => {
            const fixtures = resolve(ROOT, 'specs/lint', name, '__fixtures__');
            return readdirSync(fixtures).map((tree) => resolve(fixtures, tree));
        });
        const printed = entries.flatMap(([entry, target]) =>
            trees.flatMap((tree) => {
                const run = spawnSync(
                    'node',
                    [TOOLCHAIN_CHECKER, '--preset', join(installed, target), tree],
                    { encoding: 'utf8' },
                );
                const output = `${run.stdout}${run.stderr}`;
                return [
                    ...codes.filter((code) => output.includes(code)),
                    ...selfMentions(output, rows),
                ].map((token) => `${entry} on ${tree}: ${token}`);
            }),
        );

        // Then - every entry is in the tarball, and none prints a self pass's finding or names a self rule
        expect(entries.length).toBeGreaterThan(0);
        expect(trees.length).toBeGreaterThan(0);
        expect(
            entries.filter(([, target]) => !packed.has(target.replace(/^\.\//u, ''))),
        ).toStrictEqual([]);
        expect(printed).toStrictEqual([]);
    });

    test('a runtime, type or upstream row is a consumer row: the published surface holds it', () => {
        // Given - the channels a consumer meets through what the package publishes: its runtime's refusals, its types, its fragment's options
        const selfOnPublished = [...allRows, ...RUNTIME_RULES]
            .filter((row) => PUBLISHED_CHANNELS.has(row.channel) && row.audience === 'self')
            .map((row) => row.name);

        // Then - none is self: a self row there would be one the tarball carries to every consumer
        expect(selfOnPublished).toStrictEqual([]);
    });

    test('a meta row is a self row: it holds this package’s own suite, which no consumer runs', () => {
        // Given - every row of the meta-test channel
        const consumerMeta = allRows
            .filter((row) => row.channel === 'meta' && row.audience !== 'self')
            .map((row) => row.name);

        // Then - none is consumer: a meta row labelled consumer would ship in the catalogue a consumer reads
        expect(allRows.some((row) => row.channel === 'meta')).toBe(true);
        expect(consumerMeta).toStrictEqual([]);
    });

    test('the runtime refuses only for a consumer row, read at a heading the catalogue carries', () => {
        // Given - every row the published runtime refuses for, and the catalogue chapter its refusals read at
        const consumerRuntime = new Set(
            RUNTIME_RULES.filter((row) => row.audience === 'consumer').map((row) => row.name),
        );
        const chapter = readFileSync(resolve(ROOT, CATALOGUE_CHAPTER), 'utf8');
        const refused = Object.keys(REFUSAL_WHY);

        // Then - each is a consumer runtime row, and its anchor exists where the refusal sends the reader
        expect(refused.filter((name) => !consumerRuntime.has(name))).toStrictEqual([]);
        expect(refused.filter((name) => !chapter.includes(`<a id="${name}"></a>`))).toStrictEqual(
            [],
        );
    });
});
