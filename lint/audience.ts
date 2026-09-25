import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, symlinkSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

import { catalog } from './self-manifest.js';

/**
 * What the tarball carries, read the way a consumer's install reads it — so
 * a meta-test can hold that nothing it carries names, registers or runs a
 * rule whose audience is `self`.
 */

/** A row only this package is held to: its code and its implementation name. */
export type SelfRow = {
    id: string;
    name: string;
};

/** The rows only this package is held to. */
export function selfRows(): SelfRow[] {
    return catalog
        .filter((entry) => entry.audience === 'self')
        .map(({ id, name }) => ({ id, name }));
}

/** The names of the rows only this package is held to. */
export function selfRuleNames(): Set<string> {
    return new Set(selfRows().map((row) => row.name));
}

/**
 * The tarball `npm pack` writes, extracted under `into`: the folder of its
 * `package/`. A `node_modules` beside it points at this repository's
 * install, so an entry of the extracted package resolves its dependencies
 * the way it does in a consumer's.
 */
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

/** Every file under `dir`, relative to it. */
export function filesUnder(dir: string): string[] {
    return readdirSync(dir, { recursive: true })
        .map(String)
        .filter((path) => statSync(join(dir, path)).isFile())
        .toSorted();
}

/** A code, written as a word: `K1` and never the start of `K12`. */
function codePattern(id: string): RegExp {
    return new RegExp(String.raw`(?<![\w-])${id}(?![\w])`, 'u');
}

/**
 * Every self rule a text names — by its implementation name, by its code
 * written as a word, or through the `jterrazz-self` plugin that registers
 * one — each answered as the token found.
 */
export function selfMentions(text: string, rows: SelfRow[]): string[] {
    const found = text.includes('jterrazz-self') ? ['jterrazz-self'] : [];
    for (const { id, name } of rows) {
        if (text.includes(name)) {
            found.push(name);
        }
        if (codePattern(id).test(text)) {
            found.push(id);
        }
    }
    return found;
}

/** The relative module a bundle imports: `from "./x.js"`, `import("./x.js")`, `require("./x.js")`. */
const RELATIVE_IMPORT = /(?:\bfrom|\bimport\(|\brequire\()\s*["'](?<target>\.{1,2}\/[^"']+)["']/gu;

/** A JavaScript module node loads, whichever of its three extensions it carries. */
export const MODULE_FILE = /\.[cm]?js$/u;

/** Every JavaScript module under `dist/`, relative to the package root. */
function bundles(root: string): string[] {
    return readdirSync(join(root, 'dist'), { recursive: true })
        .map((entry) => join('dist', String(entry)))
        .filter((path) => MODULE_FILE.test(path));
}

/**
 * The packed bundles no packed bundle imports while an unpacked one does: a
 * chunk the bundler split out of what the tarball leaves behind, shipped
 * with nothing to load it. A bundle nothing imports is an entry, and not one.
 */
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

/**
 * A relative module as the bundler writes its import — a statement opening a
 * line, `import(…)` or `require(…)`, double-quoted — and never a path an
 * example in a comment or a message spells.
 */
const BUNDLER_IMPORT =
    /(?:^(?:import|export)\b[^\n]*?\bfrom\s*|^import\s*|\bimport\(|\brequire\()"(?<target>\.{1,2}\/[^"]+)"/gmu;

/**
 * The relative modules a packed bundle imports and the tarball does not
 * hold, each as `<bundle> → <module>`: an entry that cannot load where it is
 * installed, which no run of it can judge.
 */
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

/** A value a walk descends into: what can hold an export's nested values. */
function isContainer(value: unknown): value is object {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

/** The `audience` a rule object's `meta.docs` declares, if it is one. */
function audienceOf(value: object): unknown {
    const { meta } = value as { meta?: unknown };
    if (!isContainer(meta)) {
        return undefined;
    }
    const { docs } = meta as { docs?: unknown };
    return isContainer(docs) ? (docs as { audience?: unknown }).audience : undefined;
}

/**
 * An own property's value, through its getter if it has one — a module
 * namespace a loader wraps answers its exports as accessors — and nothing
 * when the getter refuses the receiver it is read on.
 */
function readOwn(node: object, key: string): unknown {
    try {
        return Reflect.get(node, key);
    } catch {
        return undefined;
    }
}

/** Whether a key or a string names a self rule: its name, or a `jterrazz-self/` id. */
function namesSelf(text: string, self: Set<string>): boolean {
    return text.startsWith('jterrazz-self/') || self.has(text.slice(text.indexOf('/') + 1));
}

/**
 * Every place under `value` a consumer would meet a self rule: a rule object
 * whose `meta.docs.audience` is `self`, a key or a string that is a self
 * rule's name or a `jterrazz-self/` id — a rule map's key among them — at
 * any depth, so the fragment's `overrides[].rules` too. Each is answered as
 * the path it was found at.
 */
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
