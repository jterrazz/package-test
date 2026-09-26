import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { declaredSubpaths } from './package-exports.js';
import { materialAt } from './production.js';

const ROOT = resolve(import.meta.dirname, '../..');

function ownManifest(): { exports: Record<string, Record<string, string> | string> } {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: the shape asserted here is the one the assertions below read, and a wrong one fails them
    return JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        exports: Record<string, Record<string, string> | string>;
    };
}

function exportedNames(bundle: string): string[] {
    const names: string[] = [];
    for (const group of bundle.matchAll(/export\s*\{(?<names>[^}]*)\}\s*;/gu)) {
        for (const entry of (group.groups?.names ?? '').split(',')) {
            const published = entry
                .trim()
                .split(/\s+as\s+/u)
                .at(-1);
            if (published !== undefined && published !== '') {
                names.push(published);
            }
        }
    }
    return names;
}

async function builtEntry(path: string): Promise<Record<string, unknown>> {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a computed specifier resolves to `any`: naming the module's shape is exactly what these tests compare
    return (await import(resolve(ROOT, path))) as Record<string, unknown>;
}

/** A negation withdraws nothing at that level. */
function publishedRoots(): Set<string> {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: `files` is the array this reads
    const { files } = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        files: string[];
    };
    return new Set(files.filter((entry) => !entry.startsWith('!')));
}

function citedDocPaths(text: string): string[] {
    const cited = [...text.matchAll(/docs\/[\w./-]*\.md|docs\/reference\//gu)].map(
        (match) => match[0],
    );
    return [...new Set(cited)];
}

function sourceCitations(): string[] {
    const cited: string[] = [];
    for (const entry of readdirSync(resolve(ROOT, 'src'), { recursive: true })) {
        const path = String(entry);
        if (path.endsWith('.ts')) {
            const source = readFileSync(resolve(ROOT, 'src', path), 'utf8');
            cited.push(...citedDocPaths(source));
        }
    }
    return [...new Set(cited)];
}

function unpublished(paths: string[]): string[] {
    const published = publishedRoots();
    return paths.filter((path) => {
        const file = path.split('#')[0] ?? '';
        const root = file.split('/')[0] ?? '';
        return !published.has(root) || !existsSync(resolve(ROOT, file));
    });
}

function manifestAt(dir: string, manifest: unknown): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify(manifest));
}

/** Its subpath dropped. */
function packageOf(specifier: string): string {
    const parts = specifier.split('/');
    return (specifier.startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1)).join('/');
}
function augmentedPackages(): string[] {
    const augmented = new Set<string>();
    for (const name of readdirSync(resolve(ROOT, 'dist'))) {
        if (/\.d\.c?ts$/u.test(name)) {
            const text = readFileSync(resolve(ROOT, 'dist', name), 'utf8');
            for (const found of text.matchAll(/^declare module ['"](?<specifier>[^'"]+)['"]/gmu)) {
                augmented.add(packageOf(found.groups?.specifier ?? ''));
            }
        }
    }
    return [...augmented].toSorted();
}
function requiredOfAConsumer(): Set<string> {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: these are the three blocks this reads
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };
    const peers = Object.keys(manifest.peerDependencies ?? {}).filter(
        (name) => manifest.peerDependenciesMeta?.[name]?.optional !== true,
    );
    return new Set([...Object.keys(manifest.dependencies ?? {}), ...peers]);
}
function compiledSources(): string[] {
    const sources = new Set<string>();
    for (const entry of readdirSync(resolve(ROOT, 'dist'), { recursive: true })) {
        const map = resolve(ROOT, 'dist', String(entry));
        if (map.endsWith('.map')) {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: `sources` is the one field this reads
            const { sources: listed } = JSON.parse(readFileSync(map, 'utf8')) as {
                sources: string[];
            };
            for (const source of listed) {
                sources.add(resolve(dirname(map), source));
            }
        }
    }
    return [...sources].filter((source) => !source.includes('/node_modules/'));
}
describe('declaredSubpaths', () => {
    test('package-exports — `no-unpublished-subpath` reads the published contract — lists every subpath of the exports map, never the root', () => {
        // Given - an install whose manifest publishes two subpaths
        const root = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));
        manifestAt(root, {
            exports: { '.': {}, './oxlint': {}, './vitest': {} },
            name: '@jterrazz/test',
        });
        const dist = resolve(root, 'dist');
        mkdirSync(dist, { recursive: true });

        // Then - the root export is not a subpath; the other two are, specifier-formed
        expect(declaredSubpaths(dist)).toStrictEqual([
            '@jterrazz/test/oxlint',
            '@jterrazz/test/vitest',
        ]);
    });

    test('package-exports — `no-unpublished-subpath` reads the published contract — reads an install in a gitignored node_modules — a dependency is read from the disk', () => {
        // Given - a consumer checkout that ignores node_modules, with the package installed as a copy under it
        const root = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));
        manifestAt(root, { name: 'some-consumer' });
        writeFileSync(resolve(root, '.gitignore'), 'node_modules/\n');
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        const installed = resolve(root, 'node_modules/@jterrazz/test');
        manifestAt(installed, {
            exports: { '.': {}, './oxlint': {}, './vitest': {} },
            name: '@jterrazz/test',
        });
        const dist = resolve(installed, 'dist');
        mkdirSync(dist, { recursive: true });

        // Then - git's listing does not decide what a dependency publishes
        expect(declaredSubpaths(dist)).toStrictEqual([
            '@jterrazz/test/oxlint',
            '@jterrazz/test/vitest',
        ]);
    });

    test('package-exports — `no-unpublished-subpath` reads the published contract — the walk stops at the first manifest — a host project vouches for nothing', () => {
        // Given - a consumer manifest sitting above, with subpaths of its own
        const root = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));
        manifestAt(root, { exports: { './anything': {} }, name: 'some-consumer' });
        const nested = resolve(root, 'node_modules/other/dist');
        mkdirSync(nested, { recursive: true });

        // Then - a foreign manifest ends the search: no exemption is inherited
        expect(declaredSubpaths(nested)).toStrictEqual([]);
    });

    test('package-exports — `no-unpublished-subpath` reads the published contract — no manifest at all yields no exemption — `no-unpublished-subpath` applies plainly', () => {
        // Given - a directory with nothing above it to read
        const orphan = mkdtempSync(resolve(tmpdir(), 'pkg-exports-'));

        // Then - with no contract to read, no subpath can be vouched for
        expect(declaredSubpaths(orphan)).toStrictEqual([]);
    });

    test("package-exports — `no-unpublished-subpath` reads the published contract — this package's own manifest is what the rule actually reads", () => {
        // Given - the framework linting itself, resolved from this module
        const subpaths = declaredSubpaths();

        // Then - every published surface is exempt, and nothing else is
        expect(subpaths).toStrictEqual([
            '@jterrazz/test/oxlint',
            '@jterrazz/test/schema',
            '@jterrazz/test/vitest',
        ]);
    });

    test('package-exports — the root has two runtimes and one type surface — the root export answers a page under the browser condition', () => {
        // Given - the published map of the root export
        const root = ownManifest().exports['.'];

        // Then - a page gets the browser build, node keeps the ESM one, types are shared
        expect(root).toStrictEqual({
            browser: './dist/browser/index.js',
            import: './dist/index.js',
            types: './dist/index.d.ts',
        });
    });

    test('package-exports — the root has two runtimes and one type surface — the browser build carries every name the node build exports', async () => {
        // Given - the node entry, and the page's bundle read as text: it opens browser Mode's own context module, which refuses to load under node — which is the very reason the second build exists (`npm run build` first)
        const node = await builtEntry('dist/index.js');
        const browser = exportedNames(readFileSync(resolve(ROOT, 'dist/browser/index.js'), 'utf8'));

        // Then - one surface: neither side has a name the other lacks
        expect(browser.toSorted()).toStrictEqual(Object.keys(node).toSorted());
    });

    test('package-exports — the published types name what a consumer has — every package a declaration augments is a dependency or a required peer', () => {
        // Given - the packages the built declarations merge into (`npm run build` first)
        const augmented = augmentedPackages();

        // Then - a consumer typechecking them has each one, whatever it installed beside this package
        expect(augmented).toContain('@jterrazz/typescript');
        const required = requiredOfAConsumer();
        expect(augmented.filter((name) => !required.has(name))).toStrictEqual([]);
    });

    test('package-exports — the tarball carries what a message points at — every chapter the README links is a file the install holds', () => {
        // Given - the vitrine, whose links are relative and therefore resolved inside the install
        const cited = citedDocPaths(readFileSync(resolve(ROOT, 'README.md'), 'utf8'));

        // Then - every one of them is under a published path and on disk
        expect(cited.length).toBeGreaterThan(0);
        expect(unpublished(cited)).toStrictEqual([]);
    });

    test('package-exports — the tarball carries what a message points at — every chapter a diagnostic cites is a file the install holds', () => {
        // Given - the `(… — see docs/19-linting.md#…)` a rule message ends on: a consumer follows it inside node_modules
        const cited = sourceCitations();

        // Then - the anchor's file ships, so the pointer resolves where it is read
        expect(cited.length).toBeGreaterThan(0);
        expect(unpublished(cited)).toStrictEqual([]);
    });

    test('package-exports — the build is compiled from production alone — no module a bundle is built from is test material', () => {
        // Given - the source modules every bundle's map lists (`npm run build` first)
        const sources = compiledSources();

        // Then - the facet constructors among them, and not one test, fixture, spec or ground file
        expect(sources).toContain(resolve(ROOT, 'src/facets/api/api.handle.ts'));
        const material = sources.filter((source) => materialAt(source) !== undefined);
        expect(material.map((source) => relative(ROOT, source))).toStrictEqual([]);
    });
});
