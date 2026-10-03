import { blankComments, GROUND_FIXTURES, treeKind } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { closingOf, literalEnd } from './source-scan.js';

/** Read from the modules that build the spec's runners. A literal naming a file inside a specimen names the app; one naming the folder is a root, and names the app only when it feeds a server command, since a root alone is where services read their ground. */

const INTO_FIXTURES = new RegExp(
    String.raw`(?:^|[/'"\x60\s])${GROUND_FIXTURES}/(?<name>[\w.-]+)(?<inside>/[\w.-])?`,
    'u',
);

const SPECIFICATION_FROM = /\bfrom\s*['"](?<from>[^'"]*\.specification(?:\.[jt]s)?)['"]/gu;

const IMPORT_FROM = /\bfrom\s*['"](?<from>[^'"]+)['"]/gu;

const BUILDS_A_RUNNER = /\bspecification\.\w+\s*\(/gu;

const CONST_NAME = /\bconst\s+(?<name>[A-Za-z_$][\w$]*)\s*=/gu;

const SERVER_OBJECT = /\bserver\s*:\s*\{/gu;

const RUNS_A_COMMAND = /\bcommand\s*:/u;

const CALLS_A_MODULE = 'integration';

function literalsOf(blank: string): { at: number; literal: string }[] {
    const literals: { at: number; literal: string }[] = [];
    for (let index = 0; index < blank.length;) {
        const end = literalEnd(blank, index);
        if (end === index) {
            index += 1;
        } else {
            literals.push({ at: index, literal: blank.slice(index, end) });
            index = end;
        }
    }
    return literals;
}

function runnerCalls(blank: string): { end: number; start: number }[] {
    return [...blank.matchAll(BUILDS_A_RUNNER)].map((match) => {
        const open = match.index + match[0].length - 1;
        return { end: closingOf(blank, open), start: open };
    });
}

function runsAServerCommand(call: string): boolean {
    return [...call.matchAll(SERVER_OBJECT)].some((match) => {
        const open = match.index + match[0].length - 1;
        return RUNS_A_COMMAND.test(call.slice(open, closingOf(call, open) + 1));
    });
}

function constHolding(blank: string, at: number): string | undefined {
    const last = [...blank.slice(0, at).matchAll(CONST_NAME)].at(-1);
    if (last === undefined || blank.slice(last.index, at).includes(';')) {
        return undefined;
    }
    return last.groups?.name;
}

function rootOfAServer(blank: string, at: number): boolean {
    const calls = runnerCalls(blank);
    const around = calls.filter(({ end, start }) => start < at && at < end);
    const name = around.length === 0 ? constHolding(blank, at) : undefined;
    const named =
        name === undefined
            ? undefined
            : new RegExp(
                  String.raw`(?<![\w$.])${name.replaceAll('$', String.raw`\$`)}(?![\w$])`,
                  'u',
              );
    const fed =
        named === undefined
            ? around
            : calls.filter(({ end, start }) => named.test(blank.slice(start, end)));
    return fed.some(({ end, start }) => runsAServerCommand(blank.slice(start, end + 1)));
}

function specimenNamedIn(text: string): string | undefined {
    const blank = blankComments(text);
    for (const { at, literal } of literalsOf(blank)) {
        const groups = INTO_FIXTURES.exec(literal)?.groups;
        if (
            groups?.name !== undefined &&
            (groups.inside !== undefined || rootOfAServer(blank, at))
        ) {
            return groups.name;
        }
    }
    return undefined;
}

function doorsOf(file: string, text: string): string[] {
    return [...blankComments(text).matchAll(SPECIFICATION_FROM)].map(({ groups }) =>
        resolve(dirname(file), (groups?.from ?? '').replace(/\.js$/u, '.ts')),
    );
}

function specimenOfDoor(door: string, seen: Set<string>): string | undefined {
    if (seen.has(door) || treeKind(door) !== 'file') {
        return undefined;
    }
    seen.add(door);
    const text = readFileSync(door, 'utf8');
    const named = specimenNamedIn(text);
    if (named !== undefined) {
        return named;
    }
    for (const next of doorsOf(door, text)) {
        const name = specimenOfDoor(next, seen);
        if (name !== undefined) {
            return name;
        }
    }
    return undefined;
}

function importedSpecimen(text: string): string | undefined {
    for (const { groups } of blankComments(text).matchAll(IMPORT_FROM)) {
        const name = INTO_FIXTURES.exec(groups?.from ?? '')?.groups?.name;
        if (name !== undefined) {
            return name;
        }
    }
    return undefined;
}

/** Nothing when every runner drives the project's own app. */
export function specimenOf(file: string, text: string, facet: string): string | undefined {
    if (facet === CALLS_A_MODULE) {
        const called = importedSpecimen(text);
        if (called !== undefined) {
            return called;
        }
    }
    if (runnerCalls(blankComments(text)).length > 0) {
        const inline = specimenNamedIn(text);
        if (inline !== undefined) {
            return inline;
        }
    }
    const seen = new Set<string>();
    for (const door of doorsOf(file, text)) {
        const name = specimenOfDoor(door, seen);
        if (name !== undefined) {
            return name;
        }
    }
    return undefined;
}
