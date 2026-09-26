import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, symlinkSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

import { catalog } from '../catalogue/manifest.js';

export type SelfRow = {
    name: string;
};

export function selfRows(): SelfRow[] {
    return catalog.filter((entry) => entry.audience === 'self').map(({ name }) => ({ name }));
}

export function selfRuleNames(): Set<string> {
    return new Set(selfRows().map((row) => row.name));
}

/** A `node_modules` beside the extracted `package/` points at this repository's install, so an entry resolves its dependencies as in a consumer's. */
export function extractTarball(root: string, into: string): string {
    const output = execFileSync(
        'npm',
        ['pack', '--json', '--ignore-scripts', '--pack-destination', into],
        { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: npm prints one report per package, keyed by name (npm ≥ 11) or in an array (earlier), each with the `filename` this reads
    const parsed = JSON.parse(output) as Record<string, { filename: string }>;
    for (const { filename } of Object.values(parsed)) {
        execFileSync('tar', ['-xzf', join(into, filename), '-C', into]);
    }
    symlinkSync(join(root, 'node_modules'), join(into, 'node_modules'), 'dir');
    return join(into, 'package');
}

export function filesUnder(dir: string): string[] {
    return readdirSync(dir, { recursive: true })
        .map(String)
        .filter((path) => statSync(join(dir, path)).isFile())
        .toSorted();
}

/** `links-resolve` and never the start of `links-resolve-twice`. */
function namePattern(name: string): RegExp {
    return new RegExp(String.raw`(?<![\w-])${name}(?![\w-])`, 'u');
}

export function selfMentions(text: string, rows: SelfRow[]): string[] {
    const found = text.includes('jterrazz-self') ? ['jterrazz-self'] : [];
    for (const { name } of rows) {
        if (namePattern(name).test(text)) {
            found.push(name);
        }
    }
    return found;
}

const RELATIVE_IMPORT = /(?:\bfrom|\bimport\(|\brequire\()\s*["'](?<target>\.{1,2}\/[^"']+)["']/gu;

export const MODULE_FILE = /\.[cm]?js$/u;

function bundles(root: string): string[] {
    return readdirSync(join(root, 'dist'), { recursive: true })
        .map((entry) => join('dist', String(entry)))
        .filter((path) => MODULE_FILE.test(path));
}

/** A chunk the bundler split out of what the tarball leaves behind, shipped with nothing to load it. */
export function strandedBundles(root: string, packed: Set<string>): string[] {
    const importers = new Map<string, Set<string>>();
    for (const bundle of bundles(root)) {
        const text = readFileSync(join(root, bundle), 'utf8');
        for (const found of text.matchAll(RELATIVE_IMPORT)) {
            const absolute = join(root, dirname(bundle), found.groups?.target ?? '');
            const target = relative(root, normalize(absolute));
            const seen = importers.get(target) ?? new Set<string>();
            seen.add(bundle);
            importers.set(target, seen);
        }
    }
    return [...importers.entries()]
        .filter(([target, from]) => packed.has(target) && [...from].every((by) => !packed.has(by)))
        .map(([target]) => target)
        .toSorted();
}

/** Only the bundler's own spelling (a statement opening a line, `import(…)`, `require(…)`, double-quoted), never a path a comment or a message spells. */
const BUNDLER_IMPORT =
    /(?:^(?:import|export)\b[^\n]*?\bfrom\s*|^import\s*|\bimport\(|\brequire\()"(?<target>\.{1,2}\/[^"]+)"/gmu;

export function danglingImports(dir: string, packed: Set<string>): string[] {
    const dangling: string[] = [];
    for (const bundle of [...packed].filter((path) => MODULE_FILE.test(path))) {
        const text = readFileSync(join(dir, bundle), 'utf8');
        for (const found of text.matchAll(BUNDLER_IMPORT)) {
            const target = normalize(join(dirname(bundle), found.groups?.target ?? ''));
            if (!packed.has(target)) {
                dangling.push(`${bundle} → ${target}`);
            }
        }
    }
    return dangling.toSorted();
}

function isContainer(value: unknown): value is object {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function audienceOf(value: object): unknown {
    const { meta } = value as { meta?: unknown };
    if (!isContainer(meta)) {
        return undefined;
    }
    const { docs } = meta as { docs?: unknown };
    return isContainer(docs) ? (docs as { audience?: unknown }).audience : undefined;
}

/** A module namespace a loader wraps answers its exports as accessors, and a getter may refuse the receiver it is read on. */
function readOwn(node: object, key: string): unknown {
    try {
        return Reflect.get(node, key);
    } catch {
        return undefined;
    }
}

function namesSelf(text: string, self: Set<string>): boolean {
    return text.startsWith('jterrazz-self/') || self.has(text.slice(text.indexOf('/') + 1));
}

/** At any depth, rule-map keys included, so a fragment's `overrides[].rules` is searched too. */
export function selfExposures(value: unknown, self: Set<string>, path = '<entry>'): string[] {
    const found: string[] = [];
    const seen = new WeakSet<object>();
    const walk = (node: unknown, at: string): void => {
        if (typeof node === 'string') {
            if (namesSelf(node, self)) {
                found.push(`${at} = ${node}`);
            }
            return;
        }
        if (!isContainer(node) || seen.has(node)) {
            return;
        }
        seen.add(node);
        if (audienceOf(node) === 'self') {
            found.push(`${at} (meta.docs.audience: self)`);
        }
        for (const key of Reflect.ownKeys(node)) {
            if (typeof key === 'string') {
                const child = readOwn(node, key);
                if (namesSelf(key, self)) {
                    found.push(`${at}.${key}`);
                }
                walk(child, `${at}.${key}`);
            }
        }
    };
    walk(value, path);
    return found;
}
