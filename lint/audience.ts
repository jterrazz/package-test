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
