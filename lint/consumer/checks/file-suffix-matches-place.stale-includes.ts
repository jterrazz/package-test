import { blankComments } from '@jterrazz/typescript/rules';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { packageRootOf } from '../../kit/project/role.js';
import { SETTINGS_FILE } from '../../kit/project/settings-file.js';

export type Rename = { from: string; to: string };

const CONFIG_NAMES = [SETTINGS_FILE];

const COLLECTION = /\b(?:include|exclude)\s*:\s*\[(?<entries>[^\]]*)\]/gu;

const ENTRY = /['"`][^'"`\n]*['"`]/gu;

// outside: a glob reaches what its literal prefix (everything before the first `*`) contains, resolved against the config's own directory, as vitest does.
function reaches(dir: string, entry: string, file: string): boolean {
    const star = entry.indexOf('*');
    if (star === -1) {
        return resolve(dir, entry) === file;
    }
    return file.startsWith(`${resolve(dir, entry.slice(0, star))}/`);
}

function collectedEntries(text: string): string[] {
    return [...text.matchAll(COLLECTION)].flatMap((list) =>
        // Stryker disable next-line OptionalChaining,StringLiteral: a match always carries its named group
        [...(list.groups?.entries ?? '').matchAll(ENTRY)].map(([quoted]) => quoted.slice(1, -1)),
    );
}

function noticeFor(where: string, entry: string): string {
    return entry.includes('*')
        ? `${where}: ${entry} still names \`.test.ts\` — the files it collected are \`.spec.ts\` now, and the project collects nothing until the glob follows (file-suffix-matches-place)`
        : `${where}: ${entry} names a file this run renamed — it is \`${entry.slice(0, -'.test.ts'.length)}.spec.ts\` now, and the entry collects nothing until it follows (file-suffix-matches-place)`;
}

function staleEntriesIn(path: string, owner: string, renamed: Rename[]): string[] {
    const directory = dirname(path);
    return collectedEntries(blankComments(readFileSync(path, 'utf8')))
        .filter((entry) => entry.endsWith('.test.ts'))
        .filter((entry) => renamed.some(({ from }) => reaches(directory, entry, from)))
        .map((entry) => noticeFor(relative(owner, path), entry));
}

/** The mover cannot rewrite a config it does not parse, so it names the `include`/`exclude` entries reaching a file this run moved, and nothing else: vitest would otherwise collect fewer files and exit 0. */
export function staleIncludes(root: string, renamed: Rename[]): string[] {
    const owner = packageRootOf(root) ?? dirname(root);
    const paths = [...new Set([root, owner, dirname(root)])].flatMap((directory) =>
        CONFIG_NAMES.map((name) => join(directory, name)).filter((path) => existsSync(path)),
    );
    return paths.flatMap((path) => staleEntriesIn(path, owner, renamed));
}
