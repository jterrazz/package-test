import { rowNamed as rowOf } from '@jterrazz/typescript/rules';
import type { Chapter } from '@jterrazz/typescript/rules';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CATALOGUE_CHAPTER } from '../../kit/catalogue/chapter.js';
import { allRows, SELF_CHAPTER } from '../catalogue/manifest.js';

export const ROOT = resolve(import.meta.dirname, '../../..');

export function rowNamed(name: string): (typeof allRows)[number] {
    return rowOf(allRows, name);
}

export function chapterOf(name: string): Chapter {
    return rowNamed(name).audience === 'self' ? SELF_CHAPTER : CATALOGUE_CHAPTER;
}

const CHECKER_LINE = /^\S+:\d+:\d+: error jterrazz-check\([\w-]+\): (?<message>.*)$/u;

const REPORT_HEAD = /^\s*\S+:\d+:\d+ {2}jterrazz-check\([\w-]+\)$/u;

const REPORT_PART = /^\s+(?:found|why|fix|read): /u;

/** A lint specification's report states a finding on its head line, then its lesson a part per line: the parts are read back into one message. */
function reportMessages(lines: readonly string[]): string[] {
    const messages: string[] = [];
    for (const [index, line] of lines.entries()) {
        if (!REPORT_HEAD.test(line)) {
            continue;
        }
        const parts: string[] = [];
        for (const next of lines.slice(index + 1)) {
            if (!REPORT_PART.test(next)) {
                break;
            }
            parts.push(next.trim());
        }
        messages.push(parts.join(' · '));
    }
    return messages;
}

export function goldenCheckerLines(dir: string): string[] {
    const lines: string[] = [];
    for (const entry of readdirSync(dir, { recursive: true })) {
        const path = String(entry);
        if (path.includes('_fixtures') || !/\.(?:spec\.ts|txt)$/u.test(path)) {
            continue;
        }
        const text = readFileSync(resolve(dir, path), 'utf8').split('\n');
        lines.push(...reportMessages(text));
        for (const line of text) {
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
