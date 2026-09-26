import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { packageRootOf } from '../../engine/project/role.js';

export type Rename = { from: string; to: string };

const CONFIG_NAMES = [
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.config.cts',
    'vitest.config.js',
    'vitest.config.mjs',
    'vitest.config.cjs',
];

const COLLECTION = /\b(?:include|exclude)\s*:\s*\[(?<entries>[^\]]*)\]/gu;

const ENTRY = /['"`](?<entry>[^'"`\n]*)['"`]/gu;

const QUOTES = new Set(["'", '"', '`']);

function endOfLineComment(text: string, index: number): number {
    const newline = text.indexOf('\n', index);
    return newline === -1 ? text.length : newline;
}

function endOfBlockComment(text: string, index: number): number {
    const close = text.indexOf('*/', index + 2);
    return close === -1 ? text.length : close + 2;
}

/** Scanned character by character: a regex cannot tell `specs/api/**` + `/*.test.ts` in a string from a block comment, nor a `://` from a line comment. */
function withoutComments(text: string): string {
    let out = '';
    let quote: null | string = null;
    let index = 0;
    while (index < text.length) {
        const char = text[index] ?? '';
        const pair = text.slice(index, index + 2);
        if (quote !== null) {
            const escaped = char === '\\';
            out += escaped ? pair : char;
            quote = char === quote ? null : quote;
            index += escaped ? 2 : 1;
        } else if (pair === '//') {
            out += '\n';
            index = endOfLineComment(text, index);
        } else if (pair === '/*') {
            index = endOfBlockComment(text, index);
        } else {
            quote = QUOTES.has(char) ? char : null;
            out += char;
            index += 1;
        }
    }
    return out;
}

/** A glob reaches what its literal prefix (everything before the first `*`) contains, resolved against the config's own directory, as vitest does. */
function reaches(dir: string, entry: string, file: string): boolean {
    const star = entry.indexOf('*');
    if (star === -1) {
        return resolve(dir, entry) === file;
    }
    const prefix = resolve(dir, entry.slice(0, star));
    return file === prefix || file.startsWith(`${prefix}/`);
}

function collectedEntries(text: string): string[] {
    const entries: string[] = [];
    for (const list of text.matchAll(COLLECTION)) {
        for (const match of (list.groups?.entries ?? '').matchAll(ENTRY)) {
            entries.push(match.groups?.entry ?? '');
        }
    }
    return entries;
}

function noticeFor(where: string, entry: string): string {
    return entry.includes('*')
        ? `${where}: ${entry} still names \`.test.ts\` — the files it collected are \`.spec.ts\` now, and the project collects nothing until the glob follows (file-suffix-matches-place)`
        : `${where}: ${entry} names a file this run renamed — it is \`${entry.slice(0, -'.test.ts'.length)}.spec.ts\` now, and the entry collects nothing until it follows (file-suffix-matches-place)`;
}

function staleEntriesIn(path: string, owner: string, renamed: Rename[]): string[] {
    const directory = dirname(path);
    return collectedEntries(withoutComments(readFileSync(path, 'utf8')))
        .filter((entry) => entry.endsWith('.test.ts'))
        .filter((entry) => renamed.some(({ from }) => reaches(directory, entry, from)))
        .map((entry) => noticeFor(relative(owner, path), entry));
}

/** The mover cannot rewrite a config it does not parse, so it names the `include`/`exclude` entries reaching a file this run moved, and nothing else: vitest would otherwise collect fewer files and exit 0. */
export function staleIncludes(root: string, renamed: Rename[]): string[] {
    if (renamed.length === 0) {
        return [];
    }
    const owner = packageRootOf(root) ?? dirname(root);
    const paths = [...new Set([root, owner, dirname(root)])].flatMap((directory) =>
        CONFIG_NAMES.map((name) => join(directory, name)).filter((path) => existsSync(path)),
    );
    return paths.flatMap((path) => staleEntriesIn(path, owner, renamed));
}
