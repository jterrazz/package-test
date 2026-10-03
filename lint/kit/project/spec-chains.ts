import { closingOf } from './source-scan.js';

export const SUBJECT_FACETS = ['api', 'cli', 'job', 'mobile', 'website'] as const;

export type ChainCall = { args: string; name: string };

export type Chain = { calls: ChainCall[]; end: number; handle: string; index: number };

function chainAt(text: string, handle: string, start: number): Chain {
    const calls: ChainCall[] = [];
    let index = start + handle.length;
    for (;;) {
        const member = /^\s*\.\s*(?<name>[A-Za-z_$][\w$]*)\s*\(/u.exec(text.slice(index));
        if (member?.groups?.name === undefined) {
            return { calls, end: index, handle, index: start };
        }
        const open = index + member[0].length - 1;
        const close = closingOf(text, open);
        calls.push({ args: text.slice(open + 1, close), name: member.groups.name });
        index = close + 1;
    }
}

const SPECIFICATION_IMPORT =
    /import\s*\{(?<names>[^}]*)\}\s*from\s*['"][^'"]*\.specification(?:\.[jt]s)?['"]/gu;

const SPECIFICATION_DOOR =
    /import\s*\{(?<names>[^}]*)\}\s*from\s*['"](?<from>[^'"]*\.specification(?:\.[jt]s)?)['"]/gu;

/** `const events = api.with({ … })`. */
const VIEW = /const\s+(?<view>[A-Za-z_$][\w$]*)\s*=\s*(?<from>[A-Za-z_$][\w$]*)\s*\.\s*with\s*\(/gu;

function importedHandles(names: string, facet?: string): string[] {
    return names.split(',').flatMap((name) => {
        const [imported = '', local = imported] = name.trim().split(/\s+as\s+/u);
        const wanted =
            facet === undefined
                ? (SUBJECT_FACETS as readonly string[]).includes(imported)
                : imported === facet;
        return wanted ? [local] : [];
    });
}

export function handlesOf(text: string): string[] {
    const handles = new Set<string>(
        [...text.matchAll(SPECIFICATION_IMPORT)].flatMap((found) =>
            importedHandles(found.groups?.names ?? ''),
        ),
    );
    const views = [...text.matchAll(VIEW)].map((found) => ({
        from: found.groups?.from ?? '',
        view: found.groups?.view ?? '',
    }));
    for (let size = -1; size !== handles.size;) {
        ({ size } = handles);
        for (const { from, view } of views) {
            if (handles.has(from)) {
                handles.add(view);
            }
        }
    }
    return [...handles];
}

export function chainsOf(text: string, handles: readonly string[]): Chain[] {
    if (handles.length === 0) {
        return [];
    }
    const pattern = new RegExp(String.raw`(?<![.\w$])(?:${handles.join('|')})(?=\s*\.)`, 'gu');
    return [...text.matchAll(pattern)].map((found) => chainAt(text, found[0], found.index));
}

/** A view bound to a handle (`const db = cli.with(…)`) comes under the module of that handle. */
export function doorsOf(
    text: string,
    facet: (typeof SUBJECT_FACETS)[number],
): Record<string, string> {
    const doors = new Map<string, string>();
    for (const { groups } of text.matchAll(SPECIFICATION_DOOR)) {
        for (const handle of importedHandles(groups?.names ?? '', facet)) {
            doors.set(handle, groups?.from ?? '');
        }
    }
    const views = [...text.matchAll(VIEW)].map(({ groups }) => ({
        from: groups?.from ?? '',
        view: groups?.view ?? '',
    }));
    for (let size = -1; size !== doors.size;) {
        ({ size } = doors);
        for (const { from, view } of views) {
            const door = doors.get(from);
            if (door !== undefined) {
                doors.set(view, door);
            }
        }
    }
    return Object.fromEntries(doors);
}
