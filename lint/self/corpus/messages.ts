import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CATALOGUE_CHAPTER } from '../../../src/kernel/refusals/refusal.js';
import { allRows, SELF_CHAPTER } from '../catalogue/manifest.js';

export const ROOT = resolve(import.meta.dirname, '../../..');

export function rowNamed(name: string): (typeof allRows)[number] {
    const row = allRows.find((entry) => entry.name === name);
    if (row === undefined) {
        throw new Error(`no row is named ${name}`);
    }
    return row;
}

export function chapterOf(name: string): string {
    return rowNamed(name).audience === 'self' ? SELF_CHAPTER : CATALOGUE_CHAPTER;
}

const CHECKER_LINE = /^\S+:\d+:\d+: (?:error|warning) jterrazz-check\([\w-]+\): (?<message>.*)$/u;

export function goldenCheckerLines(dir: string): string[] {
    const lines: string[] = [];
    for (const entry of readdirSync(dir, { recursive: true })) {
        const path = String(entry);
        if (path.includes('fixtures') || !/\.(?:test\.ts|txt)$/u.test(path)) {
            continue;
        }
        for (const line of readFileSync(resolve(dir, path), 'utf8').split('\n')) {
            const message = CHECKER_LINE.exec(line.trim())?.groups?.message;
            if (message !== undefined) {
                lines.push(message);
            }
        }
    }
    return lines;
}

export function sourcesUnder(dir: string): string {
    return readdirSync(dir, { recursive: true })
        .map(String)
        .filter((path) => path.endsWith('.ts') && !/\.test(?:-d)?\.tsx?$/u.test(path))
        .map((path) => readFileSync(resolve(dir, path), 'utf8'))
        .join('\n');
}
