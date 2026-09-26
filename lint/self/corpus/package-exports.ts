import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../../..');

export function ownManifest(): { exports: Record<string, Record<string, string> | string> } {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: the shape asserted here is the one the assertions below read, and a wrong one fails them
    return JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        exports: Record<string, Record<string, string> | string>;
    };
}

export function exportedNames(bundle: string): string[] {
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

export async function builtEntry(path: string): Promise<Record<string, unknown>> {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a computed specifier resolves to `any`: naming the module's shape is exactly what these tests compare
    return (await import(resolve(ROOT, path))) as Record<string, unknown>;
}

/** A negation withdraws nothing at that level. */
export function publishedRoots(): Set<string> {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse answers `any`: `files` is the array this reads
    const { files } = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
        files: string[];
    };
    return new Set(files.filter((entry) => !entry.startsWith('!')));
}

export function citedDocPaths(text: string): string[] {
    const cited = [...text.matchAll(/docs\/[\w./-]*\.md|docs\/reference\//gu)].map(
        (match) => match[0],
    );
    return [...new Set(cited)];
}

export function sourceCitations(): string[] {
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

export function unpublished(paths: string[]): string[] {
    const published = publishedRoots();
    return paths.filter((path) => {
        const file = path.split('#')[0] ?? '';
        const root = file.split('/')[0] ?? '';
        return !published.has(root) || !existsSync(resolve(ROOT, file));
    });
}

/** Its subpath dropped. */
export function packageOf(specifier: string): string {
    const parts = specifier.split('/');
    return (specifier.startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1)).join('/');
}
export function augmentedPackages(): string[] {
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
export function requiredOfAConsumer(): Set<string> {
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
export function compiledSources(): string[] {
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
