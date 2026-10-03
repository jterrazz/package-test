import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { recordAt, stringListAt, stringsAt } from '../../kit/project/json-shape.js';

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
    const manifest: unknown = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    const optional = recordAt(manifest, 'peerDependenciesMeta');
    const peers = Object.keys(stringsAt(manifest, 'peerDependencies')).filter(
        (name) => recordAt(optional, name).optional !== true,
    );
    return new Set([...Object.keys(stringsAt(manifest, 'dependencies')), ...peers]);
}

export function compiledSources(): string[] {
    const sources = new Set<string>();
    for (const entry of readdirSync(resolve(ROOT, 'dist'), { recursive: true })) {
        const map = resolve(ROOT, 'dist', String(entry));
        if (map.endsWith('.map')) {
            for (const source of stringListAt(JSON.parse(readFileSync(map, 'utf8')), 'sources')) {
                sources.add(resolve(dirname(map), source));
            }
        }
    }
    return [...sources].filter((source) => !source.includes('/node_modules/'));
}
