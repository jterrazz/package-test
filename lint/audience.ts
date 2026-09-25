import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

import { catalog } from './manifest.js';

/**
 * What the tarball carries, read the way npm reads it — so a meta-test can
 * hold that nothing it carries runs a rule whose audience is `self`.
 */

/** The names of the rows only this package is held to. */
export function selfRuleNames(): Set<string> {
    return new Set(catalog.filter((entry) => entry.audience === 'self').map((entry) => entry.name));
}

/** Every path `npm pack` would put in the tarball, relative to the package root. */
export function packedFiles(root: string): string[] {
    const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: npm prints one report per package, keyed by name (npm ≥ 11) or in an array (earlier), each with the `files` this reads
    const parsed = JSON.parse(output) as Record<string, { files: { path: string }[] }>;
    return Object.values(parsed).flatMap((report) => report.files.map((file) => file.path));
}

/** The relative module a bundle imports: `from "./x.js"`, `import("./x.js")`, `require("./x.js")`. */
const RELATIVE_IMPORT = /(?:\bfrom|\bimport\(|\brequire\()\s*["'](?<target>\.{1,2}\/[^"']+)["']/gu;

/** Every `.js`/`.cjs` bundle under `dist/`, relative to the package root. */
function bundles(root: string): string[] {
    return readdirSync(join(root, 'dist'), { recursive: true })
        .map((entry) => join('dist', String(entry)))
        .filter((path) => /\.c?js$/u.test(path));
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

/** What one own key exposes: a `jterrazz-self/` name, or a `rules` map naming a self row. */
function keyExposures(key: string, child: unknown, at: string, self: Set<string>): string[] {
    const found = key.startsWith('jterrazz-self/') ? [`${at}.${key}`] : [];
    if (key === 'rules' && isContainer(child)) {
        for (const id of Object.keys(child)) {
            if (self.has(id.slice(id.indexOf('/') + 1))) {
                found.push(`${at}.rules.${id}`);
            }
        }
    }
    return found;
}

/**
 * Every place under `value` a consumer would meet a self rule: a rule object
 * whose `meta.docs.audience` is `self`, a key or a string naming the
 * `jterrazz-self/` plugin, and a `rules` map — at any depth, so the
 * fragment's `overrides[].rules` too — that names a self row. Each is
 * answered as the path it was found at.
 */
export function selfExposures(value: unknown, self: Set<string>, path = '<entry>'): string[] {
    const found: string[] = [];
    const seen = new WeakSet<object>();
    const walk = (node: unknown, at: string): void => {
        if (typeof node === 'string') {
            if (node.startsWith('jterrazz-self/')) {
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
                found.push(...keyExposures(key, child, at, self));
                walk(child, `${at}.${key}`);
            }
        }
    };
    walk(value, path);
    return found;
}
