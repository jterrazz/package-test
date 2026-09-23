import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { contractsOf, isContract, isContracts } from '../contracts/contract.js';
import type { Contract } from '../contracts/contract.js';
import { rowsMismatch } from '../goldens/matchers.js';
import type { CaptureScope } from '../matching/match.js';
import type { TableAccessor } from '../result/table.js';
import { documentPaths, readSpecFile, SpecSyntaxError } from './spec-document.js';
import type { SpecDocument, SpecFile, SpecKind, SpecTable } from './spec-document.js';

/**
 * What running an api or a jobs document shares: reading it for the runner that
 * was handed it, standing on its ground (every path it names exists, every
 * contract module it names loads), judging its `tables:`, and rendering a
 * failure whose one frame is the line of the document that owns it.
 *
 * The setups themselves are the chain's — a document's `seed:` is `.seed()`,
 * its `clock:` is `.clock()` — so this module decides nothing a chain does
 * not; it reads a file into those gestures.
 */

/** Where a failure is rendered against — the two forms of the same path. */
export type DocumentPlace = {
    /** The path failures name — as the reader would open it. */
    displayPath: string;
    /** Absolute path of the `.spec.yaml` file. */
    filePath: string;
};

/**
 * Point an error's stack at one frame: the line of the document that owns the
 * failure. The framework's own frames carry nothing a reader of a document can
 * act on, and the generated module's frame actively misleads.
 */
export function atLine(error: Error, filePath: string, line: number): Error {
    error.stack = `${error.name}: ${error.message}\n    at ${filePath}:${line}:1`;
    return error;
}

/** A refusal of the document itself, on the line that states what is refused. */
function refusal(place: DocumentPlace, line: number, message: string): Error {
    return atLine(new Error(`${place.displayPath}:${line}: ${message}`), place.filePath, line);
}

/**
 * Read a document for the runner of `kind`. A grammar refusal names the line; a
 * document of another kind is refused naming the runner that reads it — a
 * `kind: jobs` document handed to `api.run()` would otherwise send nothing and
 * assert nothing.
 */
export function readDocumentFor(kind: SpecKind, place: DocumentPlace): SpecFile {
    let file: SpecFile;
    try {
        file = readSpecFile(readFileSync(place.filePath, 'utf8'), place.displayPath);
    } catch (error) {
        throw error instanceof SpecSyntaxError ? atLine(error, place.filePath, error.line) : error;
    }
    if (file.document.kind !== kind) {
        throw refusal(
            place,
            1,
            `a kind: ${file.document.kind} document is run by ${file.document.kind}.run(), and this runner is specification.${kind}()'s`,
        );
    }
    return file;
}

/**
 * Every path the document names exists, as what its key reads — the runtime
 * half of C8, refused on the line that names the path, with what it resolved
 * to. A run that records its goldens (`recording`) stands without the
 * `response:` files it is about to write.
 */
export function requireDocumentPaths(
    document: SpecDocument,
    dir: string,
    place: DocumentPlace,
    recording: boolean,
): void {
    for (const { key, kind, line, path } of documentPaths(document)) {
        const target = resolve(dir, path);
        if (!existsSync(target)) {
            if (recording && key === 'response') {
                continue;
            }
            throw refusal(
                place,
                line,
                `${key}: "${path}" names nothing — ${target} does not exist`,
            );
        }
        const found = statSync(target).isDirectory() ? 'directory' : 'file';
        if (found !== kind) {
            throw refusal(
                place,
                line,
                `${key}: "${path}" names a ${found}, and ${key}: reads a ${kind}`,
            );
        }
    }
}

/**
 * The contracts each `intercept:` module exports as its default — loaded in the
 * order the document names them, as chained `.intercept()` calls register.
 */
export async function loadIntercepts(
    document: SpecDocument,
    dir: string,
    place: DocumentPlace,
): Promise<Contract[]> {
    const loaded = await Promise.all(
        document.intercepts.map(async (intercept) => {
            const module: unknown = await import(pathToFileURL(resolve(dir, intercept.path)).href);
            return { intercept, module };
        }),
    );
    return loaded.flatMap(({ intercept, module }) => {
        const exported = defaultOf(module);
        if (isContract(exported) || isContracts(exported)) {
            return contractsOf(exported);
        }
        if (Array.isArray(exported) && exported.every(isContract)) {
            return contractsOf(exported);
        }
        throw refusal(
            place,
            intercept.line,
            `intercept: "${intercept.path}" exports no contract as its default — end it with \`export default defineContracts({ … })\` (or one contract, or a list)`,
        );
    });
}

/** A module's default export, whatever the module turned out to be. */
function defaultOf(module: unknown): unknown {
    return module !== null && typeof module === 'object' && 'default' in module
        ? module.default
        : undefined;
}

/**
 * Judge every table a document states against what the database holds — the
 * first that disagrees, as `toMatchRows()` renders it, or `null`.
 */
export async function tablesMismatch(
    tables: readonly SpecTable[],
    tableOf: (name: string, database: string | undefined) => TableAccessor,
    scope: CaptureScope,
): Promise<null | { details: string; line: number }> {
    const judged = await Promise.all(
        tables.map(async (table) => {
            const accessor = tableOf(table.name, table.database ?? undefined);
            const actual = await accessor.query(table.columns);
            const message = rowsMismatch(table.name, table, actual, scope);
            return message === null ? null : { details: message, line: table.line };
        }),
    );
    return judged.find((mismatch) => mismatch !== null) ?? null;
}

/**
 * The failure a document throws: its description, the action that ran, what
 * the comparison rejected, and where to open the file — the same rendering the
 * cli's documents throw, on the line that owns the mismatch.
 */
export function documentFailure(options: {
    action: string;
    description: string;
    details: string;
    hint: string;
    line: number;
    place: DocumentPlace;
}): Error {
    const { action, description, details, hint, line, place } = options;
    const error = new Error(
        [
            'Spec mismatch',
            '',
            description,
            '',
            action,
            '',
            details,
            '',
            `${place.displayPath}:${line}`,
            hint,
        ].join('\n'),
    );
    return atLine(error, place.filePath, line);
}
