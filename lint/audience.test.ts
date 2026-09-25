import plugin, { testing } from '@jterrazz/test/oxlint';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packedFiles, selfRuleNames, strandedBundles } from './audience.js';
import { CHECKER_PASSES } from './manifest.js';
import { codeOf } from './rule-code.js';

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

    test('the published checker runs no self pass, over the trees that trip each one', () => {
        // Given - the bin the tarball publishes, run over every fixture a self pass's documents stand on
        const bin = checkerBin();
        const passes = CHECKER_PASSES.filter((row) => row.audience === 'self');
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
