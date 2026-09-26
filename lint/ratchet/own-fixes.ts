import configNames from '@jterrazz/typescript/oxlint-config-names' with { type: 'json' };
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { GROUND_DIRS } from '../../src/kernel/files/ground.js';
import { oxlintOf } from './baseline.js';

/** The plugin's autofixes run before the ratchet counts, so a diagnostic a fix settles is never counted as debt. The wrapper arms this plugin's rules alone, so no other rulebook's fixer writes a byte; it sits beside the config it wraps, since oxlint resolves `jsPlugins` and globs against that directory. `-c` turns nested discovery off, so each nested config's subtree gets a run of its own. */

const CONFIG_NAMES: readonly string[] = configNames;

export const OWN_FIXES_WRAPPER = 'oxlint.test-fix.config.mjs';

/** A `.js`, `.mjs` or `.cjs` config governs only where it is the root's. */
const NESTED_CONFIG_NAMES = [
    'oxlint.config.ts',
    'oxlint.config.mts',
    '.oxlintrc.json',
    '.oxlintrc.jsonc',
] as const;

const UNWALKED = new Set<string>([
    '.artifacts',
    '.git',
    'coverage',
    'dist',
    'node_modules',
    ...GROUND_DIRS,
]);

/** A config that fails to load exits 1 too, which alone reads as diagnostics left. */
const CONFIG_FAILURES = [
    'Failed to build configuration',
    'Failed to load config',
    'Failed to parse oxlint configuration file',
] as const;

const CATEGORIES = [
    'correctness',
    'nursery',
    'pedantic',
    'perf',
    'restriction',
    'style',
    'suspicious',
] as const;

/** As oxlint reads one: comments and trailing commas dropped, outside strings. */
const JSONC_READER = [
    'const parseJsonc = (text) => {',
    "    let out = '';",
    '    for (let at = 0; at < text.length; at += 1) {',
    '        const char = text[at];',
    "        if (char === '\"') {",
    '            let end = at + 1;',
    "            while (end < text.length && text[end] !== '\"') {",
    String.raw`                end += text[end] === '\\' ? 2 : 1;`,
    '            }',
    '            out += text.slice(at, end + 1);',
    '            at = end;',
    "        } else if (char === '/' && text[at + 1] === '/') {",
    String.raw`            const end = text.indexOf('\n', at);`,
    '            at = (end === -1 ? text.length : end) - 1;',
    "        } else if (char === '/' && text[at + 1] === '*') {",
    "            const end = text.indexOf('*/', at + 2);",
    '            at = end === -1 ? text.length : end + 1;',
    "        } else if (char === '}' || char === ']') {",
    String.raw`            out = out.replace(/,\s*$/u, '') + char;`,
    '        } else {',
    '            out += char;',
    '        }',
    '    }',
    '    return JSON.parse(out);',
    '};',
];

/** An extended rulebook is carried, so a plugin armed through `extends` keeps its rules; an extended config's relative `jsPlugins` resolve from its own folder. */
export function ownFixesConfig(config: string): string {
    const off = Object.fromEntries(CATEGORIES.map((category) => [category, 'off']));
    const json = /\.jsonc?$/u.test(config);
    return [
        "import { readFileSync } from 'node:fs';",
        "import { dirname, resolve } from 'node:path';",
        ...(json ? [] : ['', `import base from ${JSON.stringify(config)};`]),
        '',
        ...JSONC_READER,
        '',
        'const own = (rules) =>',
        "    Object.fromEntries(Object.entries(rules ?? {}).filter(([rule]) => rule.startsWith('jterrazz/')));",
        '',
        'const located = (specifier, folder) =>',
        "    folder !== undefined && specifier.startsWith('.') ? resolve(folder, specifier) : specifier;",
        '',
        'const plugins = (entries, folder) =>',
        '    entries.map((entry) =>',
        "        typeof entry === 'string'",
        '            ? located(entry, folder)',
        '            : { ...entry, specifier: located(entry.specifier, folder) },',
        '    );',
        '',
        'const armed = (config, folder) => ({',
        '    ...config,',
        `    categories: ${JSON.stringify(off)},`,
        '    ...(config.extends === undefined',
        '        ? {}',
        '        : {',
        '              extends: config.extends.map((entry) =>',
        "                  typeof entry === 'string' ? read(resolve(folder ?? import.meta.dirname, entry)) : armed(entry),",
        '              ),',
        '          }),',
        '    ...(config.jsPlugins === undefined ? {} : { jsPlugins: plugins(config.jsPlugins, folder) }),',
        "    options: { ...config.options, reportUnusedDisableDirectives: 'off', typeAware: false },",
        '    overrides: (config.overrides ?? []).map((override) => ({',
        '        ...override,',
        '        ...(override.jsPlugins === undefined ? {} : { jsPlugins: plugins(override.jsPlugins, folder) }),',
        '        rules: own(override.rules),',
        '    })),',
        '    rules: own(config.rules),',
        '});',
        '',
        "const read = (path) => armed(parseJsonc(readFileSync(path, 'utf8')), dirname(path));",
        '',
        ...(json
            ? [`export default armed(parseJsonc(readFileSync(${JSON.stringify(config)}, 'utf8')));`]
            : ['export default armed(base);']),
        '',
    ].join('\n');
}

function configIn(directory: string, names: readonly string[]): string | undefined {
    const name = names.find((candidate) => existsSync(join(directory, candidate)));
    return name === undefined ? undefined : join(directory, name);
}

/** The outermost of each subtree, which covers the ones inside it. */
export function nestedConfigDirectories(root: string): string[] {
    const found: string[] = [];
    const walk = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (!entry.isDirectory() || UNWALKED.has(entry.name)) {
                continue;
            }
            const path = join(directory, entry.name);
            if (NESTED_CONFIG_NAMES.some((name) => existsSync(join(path, name)))) {
                found.push(relative(root, path));
            } else {
                walk(path);
            }
        }
    };
    walk(root);
    return found.toSorted();
}

function failedToLoad(stdout: string): boolean {
    return stdout
        .split('\n')
        .map((line) => line.replace(/^[\s|x]*/u, ''))
        .some((line) => CONFIG_FAILURES.some((failure) => line.startsWith(failure)));
}

function fixUnder(oxlint: string, directory: string, config: string, nested: string[]): void {
    const wrapper = join(directory, OWN_FIXES_WRAPPER);
    writeFileSync(wrapper, ownFixesConfig(config));
    try {
        const ignored = [OWN_FIXES_WRAPPER, ...nested.map((dir) => `${dir}/**`)];
        const run = spawnSync(
            oxlint,
            [
                '--fix',
                '-c',
                OWN_FIXES_WRAPPER,
                ...ignored.flatMap((pattern) => ['--ignore-pattern', pattern]),
            ],
            { cwd: directory, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
        );
        if (run.status === null || run.status > 1) {
            throw new Error(
                `the checker ran ${oxlint} --fix for the plugin's own fixes and it failed:\n${run.stderr}${run.stdout}`,
            );
        }
        if (failedToLoad(run.stdout)) {
            throw new Error(
                `the checker ran ${oxlint} --fix for the plugin's own fixes, and it could not load the wrapper of ${config}:\n${run.stdout}`,
            );
        }
    } finally {
        rmSync(wrapper, { force: true });
    }
}

/** oxlint exits 1 when diagnostics remain (the ratchet's to count) and past 1 when it could not run; a config it could not load is refused by name. */
export function applyOwnFixes(root: string): void {
    const oxlint = oxlintOf(root);
    const config = configIn(root, CONFIG_NAMES);
    if (oxlint === undefined || config === undefined) {
        return;
    }
    const pending = [{ config, directory: root }];
    for (let next = pending.shift(); next !== undefined; next = pending.shift()) {
        const { directory } = next;
        const nested = nestedConfigDirectories(directory);
        fixUnder(oxlint, directory, next.config, nested);
        for (const dir of nested) {
            const inner = join(directory, dir);
            const own = configIn(inner, NESTED_CONFIG_NAMES);
            if (own !== undefined) {
                pending.push({ config: own, directory: inner });
            }
        }
    }
}
