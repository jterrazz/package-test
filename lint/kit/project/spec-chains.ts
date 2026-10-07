import { closingOf } from './source-scan.js';

export const SUBJECT_SPECIFICATIONS = ['api', 'cli', 'job', 'mobile', 'website'] as const;

export type ChainCall = { args: string; name: string };

export type Chain = { calls: ChainCall[]; end: number; handle: string; index: number };

function chainAt(text: string, handle: string, start: number): Chain {
    const calls: ChainCall[] = [];
    let index = start + handle.length;
    for (;;) {
        const member = /^\s*\.\s*(?<name>[A-Za-z_$][\w$]*)\s*\(/u.exec(text.slice(index));
        if (member === null) {
            return { calls, end: index, handle, index: start };
        }
        // Stryker disable next-line StringLiteral: a member match always carries its name
        const { name = '' } = member.groups ?? {};
        const open = index + member[0].length - 1;
        const close = closingOf(text, open);
        calls.push({ args: text.slice(open + 1, close), name });
        index = close + 1;
    }
}

const SPECIFICATION_DOOR =
    /import\s*\{(?<names>[^}]*)\}\s*from\s*['"](?<from>[^'"]*\.specification(?:\.[jt]s)?)['"]/gu;

const VIEW = /const\s+(?<view>[A-Za-z_$][\w$]*)\s*=\s*(?<from>[A-Za-z_$][\w$]*)\s*\.\s*with\s*\(/gu;

function importedDoors(text: string, wanted: (imported: string) => boolean): Map<string, string> {
    const doors = new Map<string, string>();
    for (const found of text.matchAll(SPECIFICATION_DOOR)) {
        // Stryker disable next-line StringLiteral: a door match always carries its names and its module
        const { from = '', names = '' } = found.groups ?? {};
        for (const name of names.split(',')) {
            const [imported = '', local = imported] = name.trim().split(/\s+as\s+/u);
            if (wanted(imported)) {
                doors.set(local, from);
            }
        }
    }
    return doors;
}

// invariant: a view bound to a handle (`const db = cli.with(…)`) comes under the module of that handle.
function doorsWanted(text: string, wanted: (imported: string) => boolean): Map<string, string> {
    const doors = importedDoors(text, wanted);
    const views = [...text.matchAll(VIEW)];
    for (let size = -1; size !== doors.size;) {
        ({ size } = doors);
        for (const found of views) {
            // Stryker disable next-line StringLiteral: a view match always carries its view and its handle
            const { from = '', view = '' } = found.groups ?? {};
            const door = doors.get(from);
            if (door !== undefined) {
                doors.set(view, door);
            }
        }
    }
    return doors;
}

export function handlesOf(text: string): string[] {
    return [
        ...doorsWanted(text, (imported) =>
            (SUBJECT_SPECIFICATIONS as readonly string[]).includes(imported),
        ).keys(),
    ];
}

export function chainsOf(text: string, handles: readonly string[]): Chain[] {
    if (handles.length === 0) {
        return [];
    }
    const pattern = new RegExp(String.raw`(?<![.\w$])(?:${handles.join('|')})(?=\s*\.)`, 'gu');
    return [...text.matchAll(pattern)].map((found) => chainAt(text, found[0], found.index));
}

export function doorsOf(
    text: string,
    specification: (typeof SUBJECT_SPECIFICATIONS)[number],
): Record<string, string> {
    return Object.fromEntries(doorsWanted(text, (imported) => imported === specification));
}
