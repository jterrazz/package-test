import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { GROUND_FIXTURES, SHARED_GROUND } from '../src/model/chain/ground.js';
import { treeKind } from '../src/seams/git/tree.js';
import { literalEnd, withoutComments } from './subject.js';

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
 * a literal — the module it imports the app from, the binary or the command it
 * runs, or the root its server command runs from. A root alone is where the
 * runner's services read their ground (a database's init scripts), and no app.
 *
 * An integration chain calls a module rather than a runner's app: an
 * integration spec also reaches the module of the shared fixtures it imports.
 */

/** A path into the shared fixtures, as a literal names it — the specimen's folder captured. */
const INTO_SHARED_FIXTURES = new RegExp(
    String.raw`(?:^|[/'"\x60\s])${SHARED_GROUND}/${GROUND_FIXTURES}/(?<name>[\w.-]+)`,
    'u',
);

/** A module a file imports from a specification module: `from '../api.specification.js'`. */
const SPECIFICATION_FROM = /\bfrom\s*['"](?<from>[^'"]*\.specification(?:\.[jt]s)?)['"]/gu;

/** Any module a file imports: `from '../../shared/fixtures/orders/orders.js'`. */
const IMPORT_FROM = /\bfrom\s*['"](?<from>[^'"]+)['"]/gu;

/** A runner built in the file itself: `specification.api(`. */
const BUILDS_A_RUNNER = /\bspecification\.\w+\s*\(/u;

/** The code before a literal that makes it a runner's root: `root: `. */
const ROOT_KEY = /\broot\s*:\s*$/u;

/** A runner that runs a command from its root: `command: 'node server.mjs'`. */
const RUNS_A_COMMAND = /\bcommand\s*:/u;

/** The facet whose chains call a module, never a runner's app. */
const CALLS_A_MODULE = 'integration';

/** How much of the code before a literal is kept: enough for the key it is the value of. */
const LEAD = 40;

/** The string literals of a source, its comments aside, each with the code just before it. */
function literalsOf(text: string): { before: string; literal: string }[] {
    const blank = withoutComments(text);
    const literals: { before: string; literal: string }[] = [];
    for (let index = 0; index < blank.length;) {
        const end = literalEnd(blank, index);
        if (end === index) {
            index += 1;
        } else {
            literals.push({
                before: blank.slice(Math.max(0, index - LEAD), index),
                literal: blank.slice(index, end),
            });
            index = end;
        }
    }
    return literals;
}

/** The specification modules a source imports from, resolved from its folder. */
function doorsOf(file: string, text: string): string[] {
    return [...withoutComments(text).matchAll(SPECIFICATION_FROM)].map(({ groups }) =>
        resolve(dirname(file), (groups?.from ?? '').replace(/\.js$/u, '.ts')),
    );
}

/** The specimen a module building a runner names — a root only when a command runs from it. */
function specimenNamedIn(text: string): string | undefined {
    const rootIsTheApp = RUNS_A_COMMAND.test(withoutComments(text));
    for (const { before, literal } of literalsOf(text)) {
        const name = INTO_SHARED_FIXTURES.exec(literal)?.groups?.name;
        if (name !== undefined && (rootIsTheApp || !ROOT_KEY.test(before))) {
            return name;
        }
    }
    return undefined;
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
    if (BUILDS_A_RUNNER.test(withoutComments(text))) {
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
