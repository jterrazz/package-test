import plugin, { testing } from '@jterrazz/test/oxlint';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';

import { packedFiles, selfExposures, selfRuleNames, strandedBundles } from './audience.js';
import { codeOf } from './rule-code.js';
import { SELF_CHECKER_PASSES } from './self-manifest.js';

/**
 * K12 (meta-test) — a rule only this package is held to never reaches a
 * consumer. What the tarball carries is read the way npm reads it, and the
 * entries a consumer runs are loaded as they would load them (`npm run
 * build` first).
 */
const ROOT = resolve(import.meta.dirname, '..');

/** The bin the manifest publishes for the checker. */
function checkerBin(): string {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: `bin` is the record this reads
    const { bin } = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        bin: Record<string, string>;
    };
    return bin['jterrazz-test-check'] ?? '';
}

/** One module the exports map publishes, and the condition that loads it. */
type PublishedEntry = {
    condition: string;
    subpath: string;
    target: string;
};

/**
 * Every JavaScript module the exports map resolves to, one per subpath and
 * condition — `types` is erased and a JSON schema carries no code.
 */
function publishedEntries(): PublishedEntry[] {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: `exports` is the map this reads
    const { exports } = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        exports: Record<string, unknown>;
    };
    const entries: PublishedEntry[] = [];
    const visit = (subpath: string, condition: string, node: unknown): void => {
        if (typeof node === 'string') {
            if (condition !== 'types' && /\.c?js$/u.test(node)) {
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

describe('k12 — the tarball exposes no self rule (meta-test)', () => {
    const packed = new Set(packedFiles(ROOT));
    const self = selfRuleNames();

    test('no packed file is a self bundle, nor a chunk only an unpacked bundle loads', () => {
        // Given - every path npm would publish
        const selfBundles = [...packed].filter((path) => path.startsWith('dist/self-'));

        // Then - the self bundles stay home, and so does what the bundler split out of them and of the other unshipped entries
        expect(selfBundles).toStrictEqual([]);
        expect(strandedBundles(ROOT, packed)).toStrictEqual([]);
    });

    test('the published plugin registers no self rule, and its fragment enables none', () => {
        // Given - the plugin entry, loaded through the exports map a consumer's oxlint resolves
        const registered = Object.keys(plugin.rules);
        const enabled = Object.keys(testing.rules ?? {}).map((id) => id.slice(id.indexOf('/') + 1));

        // Then - the entry is packed, and neither its rule map nor the fragment names a self rule
        expect(packed.has('dist/oxlint.js')).toBe(true);
        expect(registered.filter((id) => self.has(id))).toStrictEqual([]);
        expect(enabled.filter((id) => self.has(id))).toStrictEqual([]);
    });

    test('the walk finds a self rule wherever an export nests it', () => {
        // Given - a fragment that hides one of each kind at depth: a rule map in an override, a plugin name, a rule object
        const fragment = {
            testing: {
                jsPlugins: ['jterrazz-self/plugin'],
                overrides: [{ rules: { 'jterrazz/f7-no-framework-internals': 'off' } }],
            },
            nested: [{ meta: { docs: { audience: 'self' } } }],
        };

        // Then - each is answered at the path it was found
        expect(selfExposures(fragment, self, 'x')).toStrictEqual([
            'x.testing.jsPlugins.0 = jterrazz-self/plugin',
            'x.testing.overrides.0.rules.jterrazz/f7-no-framework-internals',
            'x.nested.0 (meta.docs.audience: self)',
        ]);
    });

    test('no module the exports map publishes exposes a self rule, at any depth', async () => {
        // Given - every published entry, loaded under the condition that resolves it — a `require` build through node's CommonJS loader, which `import()` hands its `module.exports`
        const entries = publishedEntries();
        expect(entries.map(({ condition, subpath }) => `${subpath}:${condition}`)).toStrictEqual(
            expect.arrayContaining([
                '.:import',
                '.:browser',
                './vitest:import',
                './oxlint:import',
                './oxlint:require',
            ]),
        );
        const unpacked = entries.filter(({ target }) => !packed.has(target));
        const exposures = await Promise.all(
            entries.map(async ({ condition, subpath, target }) => {
                const at = `${subpath} (${condition})`;
                if (condition === 'browser') {
                    // The browser build loads only inside Browser Mode: it is read as text
                    const text = readFileSync(resolve(ROOT, target), 'utf8');
                    return text.includes('jterrazz-self') ? [`${at} names jterrazz-self`] : [];
                }
                const loaded: unknown = await import(pathToFileURL(resolve(ROOT, target)).href);
                return selfExposures(loaded, self, at);
            }),
        );

        // Then - no rule object, plugin name nor rule map a consumer reaches is a self rule's
        expect(unpacked).toStrictEqual([]);
        expect(exposures.flat()).toStrictEqual([]);
    });

    test('the published checker runs no self pass, over the trees that trip each one', () => {
        // Given - the bin the tarball publishes, run over every fixture a self pass's documents stand on
        const bin = checkerBin();
        const passes = SELF_CHECKER_PASSES;
        expect(packed.has(bin.replace(/^\.\//u, ''))).toBe(true);
        expect(passes.length).toBeGreaterThan(0);
        for (const { name } of passes) {
            const fixtures = resolve(ROOT, 'specs/lint', name, 'fixtures');
            for (const tree of readdirSync(fixtures)) {
                const run = spawnSync('node', [resolve(ROOT, bin), resolve(fixtures, tree)], {
                    encoding: 'utf8',
                });

                // Then - it prints no finding of that pass
                expect(`${run.stdout}${run.stderr}`, `${name} on ${tree}`).not.toContain(
                    `jterrazz-check(${codeOf(name)})`,
                );
            }
        }
    });
});
