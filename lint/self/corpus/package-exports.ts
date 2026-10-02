import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../../..');

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
