import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { treeKind } from '../src/kernel/files/git-tree.js';
import { GROUND_FIXTURES, SHARED_GROUND } from '../src/kernel/files/ground.js';
import { closingOf, literalEnd, withoutComments } from './subject.js';

/**
 * A SPECIMEN: an app under `specs/shared/fixtures/` a chain reaches, rather
 * than the project's own. A spec of the project's app is filed by the route,
 * the job or the command it reaches (C29, C30); a spec of a specimen specifies
 * the FRAMEWORK, and is filed by the capability it specifies.
 *
 * Read without a hidden convention, from the modules that build the spec's
 * runners — each specification module it imports a runner from, one those
 * import a runner from in turn, and the spec itself when it builds one inline:
 * the runner reaches a specimen when one of them names the shared fixtures in
 * a literal. A literal naming a file inside a specimen's folder names the app
 * — the module it imports, the binary or the script its command runs. A
 * literal naming the folder itself is a ROOT, and names the app only when a
 * `specification.*(…)` call it feeds — inline, or through the `const` it
 * initialises — runs a server command from it (`server: { command }`): a root
 * alone is where the runner's services read their ground (a database's init
 * scripts), and no app.
 *
 * An integration chain calls a module rather than a runner's app: an
 * integration spec also reaches the module of the shared fixtures it imports.
 */

/** A path into the shared fixtures, as a literal names it — the specimen's folder captured, then whether it goes inside. */
const INTO_SHARED_FIXTURES = new RegExp(
    String.raw`(?:^|[/'"\x60\s])${SHARED_GROUND}/${GROUND_FIXTURES}/(?<name>[\w.-]+)(?<inside>/[\w.-])?`,
    'u',
);

/** A module a file imports from a specification module: `from '../api.specification.js'`. */
const SPECIFICATION_FROM = /\bfrom\s*['"](?<from>[^'"]*\.specification(?:\.[jt]s)?)['"]/gu;

/** Any module a file imports: `from '../../shared/fixtures/orders/orders.js'`. */
const IMPORT_FROM = /\bfrom\s*['"](?<from>[^'"]+)['"]/gu;

/** A runner built in the file itself: `specification.api(`. */
const BUILDS_A_RUNNER = /\bspecification\.\w+\s*\(/gu;

/** A `const` a literal may initialise: `const BROKEN = resolve(`. */
const CONST_NAME = /\bconst\s+(?<name>[A-Za-z_$][\w$]*)\s*=/gu;

/** The server a runner starts, as an object: `server: {`. */
const SERVER_OBJECT = /\bserver\s*:\s*\{/gu;

/** A command a server runs: `command: 'node server.mjs'`. */
const RUNS_A_COMMAND = /\bcommand\s*:/u;

/** The facet whose chains call a module, never a runner's app. */
const CALLS_A_MODULE = 'integration';

/** The string literals of a source whose comments are blanked, each where it starts. */
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

/** Each `specification.*(…)` call of a source whose comments are blanked: its parentheses' offsets. */
function runnerCalls(blank: string): { end: number; start: number }[] {
    return [...blank.matchAll(BUILDS_A_RUNNER)].map((match) => {
        const open = match.index + match[0].length - 1;
        return { end: closingOf(blank, open), start: open };
    });
}

/** Whether a runner's arguments start a server that runs a command: `server: { command }`. */
function runsAServerCommand(call: string): boolean {
    return [...call.matchAll(SERVER_OBJECT)].some((match) => {
        const open = match.index + match[0].length - 1;
        return RUNS_A_COMMAND.test(call.slice(open, closingOf(call, open) + 1));
    });
}

/** The `const` whose initialiser holds the offset `at`, when one does. */
function constHolding(blank: string, at: number): string | undefined {
    const last = [...blank.slice(0, at).matchAll(CONST_NAME)].at(-1);
    if (last === undefined || blank.slice(last.index, at).includes(';')) {
        return undefined;
    }
    return last.groups?.name;
}

/** Whether the root a literal at `at` names feeds a runner that runs a server command from it. */
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

/** The specimen a module building a runner names — its folder alone only as a server command's root. */
function specimenNamedIn(text: string): string | undefined {
    const blank = withoutComments(text);
    for (const { at, literal } of literalsOf(blank)) {
        const groups = INTO_SHARED_FIXTURES.exec(literal)?.groups;
        if (
            groups?.name !== undefined &&
            (groups.inside !== undefined || rootOfAServer(blank, at))
        ) {
            return groups.name;
        }
    }
    return undefined;
}

/** The specification modules a source imports from, resolved from its folder. */
function doorsOf(file: string, text: string): string[] {
    return [...withoutComments(text).matchAll(SPECIFICATION_FROM)].map(({ groups }) =>
        resolve(dirname(file), (groups?.from ?? '').replace(/\.js$/u, '.ts')),
    );
}

/** The specimen a specification module names, or one it imports a runner from names. */
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

/** The module of the shared fixtures a spec imports, by its folder. */
function importedSpecimen(text: string): string | undefined {
    for (const { groups } of withoutComments(text).matchAll(IMPORT_FROM)) {
        const name = INTO_SHARED_FIXTURES.exec(groups?.from ?? '')?.groups?.name;
        if (name !== undefined) {
            return name;
        }
    }
    return undefined;
}

/**
 * The specimen a spec of `facet` reaches, by its folder's name under
 * `specs/shared/fixtures/` — or nothing, when every runner it uses drives the
 * project's own app.
 */
export function specimenOf(file: string, text: string, facet: string): string | undefined {
    if (facet === CALLS_A_MODULE) {
        const called = importedSpecimen(text);
        if (called !== undefined) {
            return called;
        }
    }
    if (runnerCalls(withoutComments(text)).length > 0) {
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
