import { treeKind } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

export function pathFrom(from: string, to: string): string {
    const path = relative(from, to).split(sep).join('/');
    return path.startsWith('..') ? path : `./${path}`;
}

const NAMED_IMPORT =
    /^import\s*\{(?<names>[^}]*)\}\s*from\s*(?<quote>['"])(?<from>[^'"]+)\k<quote>;?/gmu;

function isEntry(from: string): boolean {
    return from === '@jterrazz/test' || /(?:^|\/)src\/index\.js$/u.test(from);
}

export function entryFor(text: string, file: string): string {
    for (const match of text.matchAll(NAMED_IMPORT)) {
        const from = match.groups?.from ?? '';
        if (!from.startsWith('.') || !/\.specification\.[jt]s$/u.test(from)) {
            continue;
        }
        const specification = join(dirname(file), from.replace(/\.js$/u, '.ts'));
        if (treeKind(specification) !== 'file') {
            continue;
        }
        for (const inner of readFileSync(specification, 'utf8').matchAll(NAMED_IMPORT)) {
            const entry = inner.groups?.from ?? '';
            if (isEntry(entry)) {
                return entry.startsWith('.')
                    ? pathFrom(dirname(file), join(dirname(specification), entry))
                    : entry;
            }
        }
    }
    return '@jterrazz/test';
}

export function mergedIntoEntry(text: string, called: Set<string>): string | undefined {
    for (const match of text.matchAll(NAMED_IMPORT)) {
        const from = match.groups?.from ?? '';
        if (!isEntry(from)) {
            continue;
        }
        const present = (match.groups?.names ?? '')
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
        const names = [...new Set([...present, ...called])].toSorted((a, b) =>
            a.toLowerCase() < b.toLowerCase() ? -1 : 1,
        );
        const quote = match.groups?.quote ?? "'";
        return text.replace(
            match[0],
            `import { ${names.join(', ')} } from ${quote}${from}${quote};`,
        );
    }
    return undefined;
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
    return [...text.matchAll(NAMED_IMPORT)].some(
        (match) =>
            isEntry(match.groups?.from ?? '') &&
            (match.groups?.names ?? '').split(',').some((each) => each.trim() === name),
    );
}

export function withoutEntryImport(text: string, name: string): string {
    for (const match of text.matchAll(NAMED_IMPORT)) {
        const from = match.groups?.from ?? '';
        if (!isEntry(from)) {
            continue;
        }
        const names = (match.groups?.names ?? '')
            .split(',')
            .map((each) => each.trim())
            .filter((each) => each.length > 0);
        if (!names.includes(name)) {
            continue;
        }
        const kept = names.filter((each) => each !== name);
        const quote = match.groups?.quote ?? "'";
        return kept.length === 0
            ? text.replace(`${match[0]}\n`, '')
            : text.replace(match[0], `import { ${kept.join(', ')} } from ${quote}${from}${quote};`);
    }
    return text;
}
