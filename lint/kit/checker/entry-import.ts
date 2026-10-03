import { treeKind } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { pathFrom } from './repoint.js';

const NAMED_IMPORT =
    /^import\s*\{(?<names>[^}]*)\}\s*from\s*(?<quote>['"])(?<from>[^'"]+)\k<quote>;?/gmu;

type Clause = { from: string; names: string[]; quote: string; text: string };

function namesIn(list: string): string[] {
    return list
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
}

function clausesOf(text: string): Clause[] {
    // Stryker disable OptionalChaining,StringLiteral,LogicalOperator: a match always carries its named groups
    return [...text.matchAll(NAMED_IMPORT)].map((match) => ({
        from: match.groups?.from ?? '',
        names: namesIn(match.groups?.names ?? ''),
        quote: match.groups?.quote ?? "'",
        text: match[0],
    }));
    // Stryker restore OptionalChaining,StringLiteral,LogicalOperator
}

function isEntry(from: string): boolean {
    return from === '@jterrazz/test' || /(?:^|\/)src\/index\.js$/u.test(from);
}

export function entryFor(text: string, file: string): string {
    for (const { from } of clausesOf(text)) {
        // Stryker disable next-line Regex: an import names a module, never a longer extension after its own
        if (!from.startsWith('.') || !/\.specification\.[jt]s$/u.test(from)) {
            continue;
        }
        // Stryker disable next-line Regex: a specification's name holds no .js before its extension
        const specification = join(dirname(file), from.replace(/\.js$/u, '.ts'));
        if (treeKind(specification) !== 'file') {
            continue;
        }
        const entry = clausesOf(readFileSync(specification, 'utf8')).find((clause) =>
            isEntry(clause.from),
        )?.from;
        if (entry !== undefined) {
            return entry.startsWith('.')
                ? pathFrom(dirname(file), join(dirname(specification), entry))
                : entry;
        }
    }
    return '@jterrazz/test';
}

/** Sorted as a reader scans them: case aside. */
function byName(a: string, b: string): number {
    // Stryker disable next-line EqualityOperator: the names are distinct
    return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
}

export function mergedIntoEntry(text: string, called: Set<string>): string | undefined {
    const clause = clausesOf(text).find(({ from }) => isEntry(from));
    if (clause === undefined) {
        return undefined;
    }
    const names = [...new Set([...clause.names, ...called])].toSorted(byName);
    return text.replace(
        clause.text,
        `import { ${names.join(', ')} } from ${clause.quote}${clause.from}${clause.quote};`,
    );
}

const IMPORT_STATEMENT = /^import[\s\S]*?from\s*(?<quote>['"])(?<from>[^'"]+)\k<quote>;?$/gmu;

/** A package import sits before the first relative one; a relative entry sits last. */
export function withImport(text: string, line: string, entry: string): string {
    const imports = [...text.matchAll(IMPORT_STATEMENT)];
    const firstRelative = entry.startsWith('.')
        ? undefined
        : imports.find((match) => (match.groups?.from ?? '').startsWith('.'));
    const at = firstRelative?.index;
    if (at !== undefined) {
        const before = text.slice(0, at);
        if (before.trim().length === 0) {
            return `${before}${line}\n\n${text.slice(at)}`;
        }
        const gap = before.endsWith('\n\n') ? at - 1 : at;
        return `${text.slice(0, gap)}${line}\n${text.slice(gap)}`;
    }
    const last = imports.at(-1);
    if (last?.index === undefined) {
        return `${line}\n${text}`;
    }
    const end = last.index + last[0].length;
    return `${text.slice(0, end)}\n${line}${text.slice(end)}`;
}

export function withEntryImport(text: string, file: string, name: string): string {
    const merged = mergedIntoEntry(text, new Set([name]));
    if (merged !== undefined) {
        return merged;
    }
    const entry = entryFor(text, file);
    return withImport(text, `import { ${name} } from '${entry}';`, entry);
}

export function importsFromEntry(text: string, name: string): boolean {
    return clausesOf(text).some(({ from, names }) => isEntry(from) && names.includes(name));
}

export function withoutEntryImport(text: string, name: string): string {
    const clause = clausesOf(text).find(({ from, names }) => isEntry(from) && names.includes(name));
    if (clause === undefined) {
        return text;
    }
    const kept = clause.names.filter((each) => each !== name);
    return kept.length === 0
        ? text.replace(`${clause.text}\n`, '')
        : text.replace(
              clause.text,
              `import { ${kept.join(', ')} } from ${clause.quote}${clause.from}${clause.quote};`,
          );
}
