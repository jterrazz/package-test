import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { REFUSAL_WHY } from '../src/kernel/refusals/refusal.js';
import {
    danglingImports,
    extractTarball,
    filesUnder,
    MODULE_FILE,
    selfExposures,
    selfMentions,
    selfRows,
    selfRuleNames,
    strandedBundles,
} from './audience.js';
import { RUNTIME_RULES } from './manifest.js';
import { CATALOGUE_CHAPTER, codeOf } from './rule-code.js';
import { catalog, SELF_CHECKER_PASSES } from './self-manifest.js';

/** K12 (meta-test) — a rule only this package is held to never reaches a consumer: the tarball is packed and extracted as an install holds it, so `npm run build` comes first. */
const ROOT = resolve(import.meta.dirname, '..');

type Manifest = {
    bin?: Record<string, string>;
    exports: Record<string, unknown>;
};

function manifestOf(dir: string): Manifest {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: `bin` and `exports` are the fields this reads
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest;
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
    const scratch = mkdtempSync(join(tmpdir(), 'k12-tarball-'));
    const installed = extractTarball(ROOT, scratch);
    const packed = new Set(filesUnder(installed));
    const rows = selfRows();
    const self = selfRuleNames();

    test('no byte the tarball carries names a self rule', () => {
        // Given - every file of the extracted tarball, read as text: bundles, chunks, types, pages, manifest
        const mentions = [...packed].flatMap((path) =>
            selfMentions(readFileSync(join(installed, path), 'utf8'), rows).map(
                (token) => `${path}: ${token}`,
            ),
        );

        // Then - no self rule's name, code, nor the plugin that registers one, is in any of it
        expect(packed.has('package.json')).toBe(true);
        expect(mentions).toStrictEqual([]);
    });

    test('a text is found naming a self rule by its name, its code, or its plugin', () => {
        // Given - one text per way of naming a row, and one that only looks like a code
        const [row] = rows;
        const named = row === undefined ? [] : [`${row.name} runs`, `rule ${row.id}.`];

        // Then - each is found, and a longer code sharing a prefix is not the row's
        expect(named.map((text) => selfMentions(text, rows).length > 0)).toStrictEqual([
            true,
            true,
        ]);
        expect(selfMentions('"jterrazz-self/x": "error"', rows)).toContain('jterrazz-self');
        expect(selfMentions('K12 holds', [{ id: 'K1', name: 'k1-x' }])).toStrictEqual([]);
    });

    test('no packed chunk is one only an unpacked bundle loads, nor imports one the tarball lacks', () => {
        // Given - the bundles the build writes, and the paths the tarball holds
        // Then - what the bundler split out of the unshipped entries stays home with them, and every packed bundle loads from the tarball alone
        expect(strandedBundles(ROOT, packed)).toStrictEqual([]);
        expect(danglingImports(installed, packed)).toStrictEqual([]);
    });

    test('no packed module cites a page the tarball leaves out', () => {
        // Given - every page a packed module names, the `read:` part of a lesson among them
        const cited = [...packed]
            .filter((path) => MODULE_FILE.test(path))
            .flatMap((path) =>
                [
                    ...readFileSync(join(installed, path), 'utf8').matchAll(/docs\/[\w./-]+\.md/gu),
                ].map(([page]) => `${path}: ${page}`),
            );

        // Then - some are, and each is in the tarball: the chapter of the self rows stays home, and so does the code that routes a reader there
        expect(cited.length).toBeGreaterThan(0);
        expect(
            cited.filter((line) => !packed.has(line.slice(line.indexOf(': ') + 2))),
        ).toStrictEqual([]);
    });

    test('the walk finds a self rule wherever an export nests it', () => {
        // Given - a fragment that hides one of each kind at depth: a rule map in an override, a plugin name, a rule object, a rule keyed by its bare name
        const fragment = {
            testing: {
                jsPlugins: ['jterrazz-self/plugin'],
                overrides: [{ rules: { 'jterrazz/f7-no-framework-internals': 'off' } }],
            },
            nested: [{ meta: { docs: { audience: 'self' } } }],
            plugin: { rules: { 'c35-capability-folder': {} } },
        };

        // Then - each is answered at the path it was found
        expect(selfExposures(fragment, self, 'x')).toStrictEqual([
            'x.testing.jsPlugins.0 = jterrazz-self/plugin',
            'x.testing.overrides.0.rules.jterrazz/f7-no-framework-internals',
            'x.nested.0 (meta.docs.audience: self)',
            'x.plugin.rules.c35-capability-folder',
        ]);
    });

    test('no module the exports map publishes exposes a self rule, at any depth', () => {
        // Given - every published entry of the extracted package, loaded by node itself as an install loads it — `require` takes a CommonJS build and an ES module alike, `.js`, `.cjs` or `.mjs`; a target of any other kind fails before a load
        const entries = publishedEntries(manifestOf(installed).exports);
        expect(entries.map(({ condition, subpath }) => `${subpath}:${condition}`)).toStrictEqual(
            expect.arrayContaining([
                '.:import',
                '.:browser',
                './vitest:import',
                './oxlint:import',
                './oxlint:require',
            ]),
        );
        expect(entries.filter(({ target }) => !MODULE_FILE.test(target))).toStrictEqual([]);
        const load = createRequire(join(installed, 'package.json'));
        const exposures = entries
            .filter(({ condition }) => condition !== 'browser')
            .map(({ condition, subpath, target }) => {
                const loaded: unknown = load(join(installed, target));
                return selfExposures(loaded, self, `${subpath} (${condition})`);
            });

        // Then - every entry is a module node loads and is in the tarball, and no rule object, name nor rule map a consumer reaches is a self rule's — the browser build, which loads only inside Browser Mode, is held by the text above
        expect(entries.filter(({ target }) => !packed.has(target))).toStrictEqual([]);
        expect(exposures.flat()).toStrictEqual([]);
    });

    test('no bin the tarball publishes runs a self pass, over the trees that trip each one', () => {
        // Given - every bin of the extracted package, run over every fixture a self pass's documents stand on
        const bins = Object.entries(manifestOf(installed).bin ?? {});
        const codes = SELF_CHECKER_PASSES.map(({ name }) => `jterrazz-check(${codeOf(name)})`);
        const trees = SELF_CHECKER_PASSES.flatMap(({ name }) => {
            const fixtures = resolve(ROOT, 'specs/lint', name, 'fixtures');
            return readdirSync(fixtures).map((tree) => resolve(fixtures, tree));
        });
        const printed = bins.flatMap(([bin, target]) =>
            trees.flatMap((tree) => {
                const run = spawnSync('node', [join(installed, target), tree], {
                    encoding: 'utf8',
                });
                const output = `${run.stdout}${run.stderr}`;
                return [
                    ...codes.filter((code) => output.includes(code)),
                    ...selfMentions(output, rows),
                ].map((token) => `${bin} on ${tree}: ${token}`);
            }),
        );

        // Then - every bin is in the tarball, and none prints a self pass's finding or names a self rule
        expect(bins.length).toBeGreaterThan(0);
        expect(trees.length).toBeGreaterThan(0);
        expect(
            bins.filter(([, target]) => !packed.has(target.replace(/^\.\//u, ''))),
        ).toStrictEqual([]);
        expect(printed).toStrictEqual([]);
    });

    test('a runtime, type or upstream row is a consumer row: the published surface holds it', () => {
        // Given - the channels a consumer meets through what the package publishes: its runtime's refusals, its types, its fragment's options
        const selfOnPublished = catalog
            .filter((row) => PUBLISHED_CHANNELS.has(row.channel) && row.audience === 'self')
            .map((row) => row.name);

        // Then - none is self: a self row there would be one the tarball carries to every consumer
        expect(selfOnPublished).toStrictEqual([]);
    });

    test('a meta row is a self row: it holds this package’s own suite, which no consumer runs', () => {
        // Given - every row of the meta-test channel
        const consumerMeta = catalog
            .filter((row) => row.channel === 'meta' && row.audience !== 'self')
            .map((row) => row.name);

        // Then - none is consumer: a meta row labelled consumer would ship in the catalogue a consumer reads
        expect(catalog.some((row) => row.channel === 'meta')).toBe(true);
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
