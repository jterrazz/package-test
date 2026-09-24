import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { oxlintOf } from './ratchet.js';

/**
 * The fix pass the checker's `--fix` owes its ratchet: the autofixes of THIS
 * package's oxlint plugin, applied before the ratchet counts the plugin's
 * diagnostics — so a diagnostic the fix settles (B16w's `with()` view, C31's
 * describe, D28's shared expectation) is never counted as debt by the run that
 * settles it.
 *
 * It runs the project's own oxlint with `--fix` under a wrapper of the
 * project's root config that arms the plugin's rules alone: every other rule
 * and every category off, so no fixer of another rulebook — the toolchain's,
 * whose meaning-changing fixers its own `fix` disarms — writes a byte here.
 * The wrapper sits beside the config it wraps (oxlint resolves `jsPlugins`,
 * `ignorePatterns` and override globs against that directory), is ignored by
 * the run it configures, and is deleted by it. A project with no oxlint, or no
 * root config to arm the plugin, has nothing to fix.
 */

/** The config names oxlint looks for at a root, in its order. */
const CONFIG_NAMES = [
    'oxlint.config.ts',
    'oxlint.config.mts',
    'oxlint.config.mjs',
    'oxlint.config.js',
    'oxlint.config.cjs',
    '.oxlintrc.json',
    '.oxlintrc.jsonc',
] as const;

/** The name the wrapper takes, beside the config it wraps. */
export const OWN_FIXES_WRAPPER = 'oxlint.test-fix.config.mjs';

/** Every category oxlint ships, each turned off by the wrapper. */
const CATEGORIES = [
    'correctness',
    'nursery',
    'pedantic',
    'perf',
    'restriction',
    'style',
    'suspicious',
] as const;

/** The wrapper module's source around the config at `config` (absolute). */
export function ownFixesConfig(config: string): string {
    const attributes = /\.jsonc?$/u.test(config) ? " with { type: 'json' }" : '';
    const off = Object.fromEntries(CATEGORIES.map((category) => [category, 'off']));
    return [
        `import base from ${JSON.stringify(config)}${attributes};`,
        '',
        'const own = (rules) =>',
        "    Object.fromEntries(Object.entries(rules ?? {}).filter(([rule]) => rule.startsWith('jterrazz/')));",
        '',
        'export default {',
        '    ...base,',
        `    categories: ${JSON.stringify(off)},`,
        '    rules: own(base.rules),',
        '    overrides: (base.overrides ?? []).map((override) => ({ ...override, rules: own(override.rules) })),',
        "    options: { ...base.options, reportUnusedDisableDirectives: 'off', typeAware: false },",
        '};',
        '',
    ].join('\n');
}

/** The config oxlint would find at `root`, or `undefined`. */
function rootConfigOf(root: string): string | undefined {
    const name = CONFIG_NAMES.find((candidate) => existsSync(join(root, candidate)));
    return name === undefined ? undefined : join(root, name);
}

/**
 * Apply the plugin's autofixes over the project at `root`. oxlint exits 1 when
 * diagnostics remain — the ratchet's to count — and past 1 when it could not
 * run, which is refused naming the binary.
 */
export function applyOwnFixes(root: string): void {
    const oxlint = oxlintOf(root);
    const config = rootConfigOf(root);
    if (oxlint === undefined || config === undefined) {
        return;
    }
    const wrapper = join(root, OWN_FIXES_WRAPPER);
    writeFileSync(wrapper, ownFixesConfig(config));
    try {
        const run = spawnSync(
            oxlint,
            ['--fix', '-c', OWN_FIXES_WRAPPER, '--ignore-pattern', OWN_FIXES_WRAPPER],
            { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
        );
        if (run.status === null || run.status > 1) {
            throw new Error(
                `the checker ran ${oxlint} --fix for the plugin's own fixes and it failed:\n${run.stderr}${run.stdout}`,
            );
        }
    } finally {
        rmSync(wrapper, { force: true });
    }
}
