import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const EXPORT_LIST = /export\s+(?:type\s+)?\{(?<names>[^}]*)\}/gu;
const EXPORT_DECLARATION =
    /export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|function|class|type|interface|enum)\s+(?<name>[A-Za-z_$][\w$]*)/gu;
const EXPORT_ALL = /export\s+\*\s+from\s+'(?<from>\.[^']+)'/gu;

/** The names an export or import list binds, `type` and `as` read: `a, type B, c as d` binds `a`, `B`, `d`. */
export function namesOf(list: string): string[] {
    return list
        .split(',')
        .map((entry) =>
            entry
                .replace(/^\s*type\s+/u, '')
                .split(/\s+as\s+/u)
                .at(-1)
                ?.trim(),
        )
        .filter((name): name is string => name !== undefined && name !== '');
}

/** Every name a module publishes, read off its text: its export lists and declarations, and the modules it re-exports whole. */
export function exportedNames(file: string): Set<string> {
    const text = readFileSync(file, 'utf8');
    const names = new Set<string>();
    for (const match of text.matchAll(EXPORT_LIST)) {
        for (const name of namesOf(match.groups?.names ?? '')) {
            names.add(name);
        }
    }
    for (const match of text.matchAll(EXPORT_DECLARATION)) {
        names.add(match.groups?.name ?? '');
    }
    for (const match of text.matchAll(EXPORT_ALL)) {
        const from = resolve(dirname(file), (match.groups?.from ?? '').replace(/\.js$/u, '.ts'));
        for (const name of exportedNames(from)) {
            names.add(name);
        }
    }
    return names;
}
