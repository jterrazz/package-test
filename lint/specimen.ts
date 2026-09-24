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
 * Read without a hidden convention: a spec reaches a specimen when a
 * specification module it imports a runner from — or one that module imports
 * a runner from in turn — names the shared fixtures in a literal: the root it
 * hands the runner, the module it imports the app from, the binary it runs.
 */

/** A path into the shared fixtures, as a literal names it — the specimen's folder captured. */
const INTO_SHARED_FIXTURES = new RegExp(
    String.raw`(?:^|[/'"\x60\s])${SHARED_GROUND}/${GROUND_FIXTURES}/(?<name>[\w.-]+)`,
    'u',
);

/** A module a file imports from a specification module: `from '../api.specification.js'`. */
const SPECIFICATION_FROM = /\bfrom\s*['"](?<from>[^'"]*\.specification(?:\.[jt]s)?)['"]/gu;

/** The string literals of a source, its comments aside. */
function literalsOf(text: string): string[] {
    const blank = withoutComments(text);
    const literals: string[] = [];
    for (let index = 0; index < blank.length;) {
        const end = literalEnd(blank, index);
        if (end === index) {
            index += 1;
        } else {
            literals.push(blank.slice(index, end));
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

/** The specimen a specification module names, or one it imports a runner from names. */
function specimenOfDoor(door: string, seen: Set<string>): string | undefined {
    if (seen.has(door) || treeKind(door) !== 'file') {
        return undefined;
    }
    seen.add(door);
    const text = readFileSync(door, 'utf8');
    for (const literal of literalsOf(text)) {
        const name = INTO_SHARED_FIXTURES.exec(literal)?.groups?.name;
        if (name !== undefined) {
            return name;
        }
    }
    for (const next of doorsOf(door, text)) {
        const name = specimenOfDoor(next, seen);
        if (name !== undefined) {
            return name;
        }
    }
    return undefined;
}

/**
 * The specimen a spec reaches, by its folder's name under
 * `specs/shared/fixtures/` — or nothing, when every runner it imports drives
 * the project's own app.
 */
export function specimenOf(file: string, text: string): string | undefined {
    const seen = new Set<string>();
    for (const door of doorsOf(file, text)) {
        const name = specimenOfDoor(door, seen);
        if (name !== undefined) {
            return name;
        }
    }
    return undefined;
}
