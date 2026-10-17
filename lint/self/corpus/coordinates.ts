import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../../..');

/** Meta-test `links-resolve`: every relative link and heading anchor of the corpus resolves, generated pages included. */
export type Coordinate = { fragment: string | undefined; from: string; target: string };

/** An absolute url is somebody else's. */
export function coordinatesOf(from: string, text: string): Coordinate[] {
    const found: Coordinate[] = [];
    for (const match of text.matchAll(/\]\((?<target>[^)\s]+)\)/gu)) {
        const target = match.groups?.target ?? '';
        if (target.startsWith('http') || target.startsWith('mailto:')) {
            continue;
        }
        found.push({ fragment: target.split('#')[1], from, target });
    }
    return found;
}

export function pages(): string[] {
    const found: string[] = ['README.md', 'AGENTS.md'];
    for (const root of ['docs', 'skills']) {
        for (const entry of readdirSync(resolve(ROOT, root), { recursive: true })) {
            const path = `${root}/${String(entry).replaceAll('\\', '/')}`;
            if (path.endsWith('.md')) {
                found.push(path);
            }
        }
    }
    return found.filter((path) => existsSync(resolve(ROOT, path)));
}

export const landingOf = (coordinate: Coordinate): string => {
    const file = coordinate.target.split('#')[0];
    return file === undefined || file === ''
        ? resolve(ROOT, coordinate.from)
        : resolve(ROOT, coordinate.from, '..', file);
};
