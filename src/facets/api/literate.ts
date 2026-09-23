import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
    buildUpdatedResponse,
    compareResponse,
    matchResponseFile,
} from '../../model/goldens/matchers.js';
import { parseRequestFile } from '../../model/http-files/http-file.js';
import type { ParsedResponseFile } from '../../model/http-files/http-file.js';
import { readJsonPath, spliceCaptures, withCaptures } from '../../model/literate/captures.js';
import { documentFailure, tablesMismatch } from '../../model/literate/document-run.js';
import type { DocumentPlace } from '../../model/literate/document-run.js';
import { updateSpecResponses } from '../../model/literate/spec-document.js';
import type {
    ResponseRewrite,
    SpecFile,
    SpecResponse,
    SpecStep,
} from '../../model/literate/spec-document.js';
import { CaptureScope } from '../../model/matching/match.js';
import type { ServerResponse } from '../../model/ports/server.port.js';
import { ResponseAccessor } from '../../model/result/response.js';
import type { TableAccessor } from '../../model/result/table.js';
import { shouldUpdateSnapshots } from '../../runner/update.js';

/**
 * Running a `kind: api` document: its steps, in order, each a request sent
 * through the app and what came back judged the moment it returns.
 *
 * The ground — seeds, contracts, the pinned clock — is laid by the chain that
 * runs this, before the first step, exactly as its own setups are; what is new
 * here is only what a chain cannot say in one call: several requests sharing
 * one database state, each judged where it stands, the later ones sending what
 * the earlier ones captured.
 */

/** One request, as the app is sent it. */
export type DocumentRequest = {
    body: unknown;
    headers: Record<string, string>;
    method: string;
    path: string;
};

/** What the chain hands the engine: its gestures, and the document it read. */
export type ApiDocumentRun = {
    /** Headers chained before `.run()` — under the document's own. */
    chainHeaders: Record<string, string>;
    file: SpecFile;
    /** Opt this document out of the update-mode rewrite. */
    frozen: boolean;
    place: DocumentPlace;
    /** Send one request through the app under test. */
    send: (request: DocumentRequest) => Promise<ServerResponse>;
    /** A table of the chain's databases, `database` as `.table()` takes it. */
    tableOf: (name: string, database: string | undefined) => TableAccessor;
};

/** The rewrite a failing run points at — what it touches, and nothing else. */
const HINT =
    "Run with TEST_UPDATE=1 to rewrite the responses — a response's status, headers and body, and nothing else.";

/** How a step reads in a failure: the request line it sent. */
function actionOf(request: DocumentRequest): string {
    return `${request.method} ${request.path}`;
}

/** Read a body file the way the chain sends one: `.json` parsed, anything else verbatim. */
function bodyFile(dir: string, path: string): unknown {
    const content = readFileSync(resolve(dir, path), 'utf8');
    return path.endsWith('.json') ? (JSON.parse(content) as unknown) : content;
}

/**
 * The request one step sends: a `.http` file whole, or an inline line with its
 * body — the captures of the earlier steps spliced into what it names. Headers
 * layer file, chain, document, then the step's own, the later winning.
 */
function requestOf(
    step: SpecStep,
    run: ApiDocumentRun,
    captured: ReadonlyMap<string, unknown>,
): DocumentRequest {
    const dir = dirname(run.place.filePath);
    const { document } = run.file;
    const stepHeaders = Object.fromEntries(
        Object.entries(step.headers).map(([name, value]) => [
            name,
            spliceCaptures(value, captured),
        ]),
    );
    if (step.request.kind === 'file') {
        const parsed = parseRequestFile(
            readFileSync(resolve(dir, step.request.path), 'utf8'),
            step.request.path,
        );
        return {
            body: parsed.body,
            headers: {
                ...parsed.headers,
                ...run.chainHeaders,
                ...document.headers,
                ...stepHeaders,
            },
            method: parsed.method,
            path: parsed.path,
        };
    }
    const body =
        step.body === null
            ? undefined
            : step.body.kind === 'file'
              ? bodyFile(dir, step.body.path)
              : withCaptures(step.body.value, captured);
    return {
        body,
        headers: { ...run.chainHeaders, ...document.headers, ...stepHeaders },
        method: step.request.method,
        path: spliceCaptures(step.request.target, captured),
    };
}

/** The inline response as the `.http` golden it stands for. */
function expectedOf(
    response: Extract<SpecResponse, { kind: 'inline' }>,
    actual: ServerResponse,
): ParsedResponseFile {
    return {
        body: response.body?.value,
        hasBody: response.body !== null,
        headers: response.headers,
        // An inline response that states no status asserts none.
        status: response.status === null ? String(actual.status) : String(response.status),
    };
}

/** What one step's judgement leaves: the failure it throws, or the rewrite it asks for. */
type Judgement = {
    failure: null | { details: string; line: number };
    rewrite: null | ResponseRewrite;
};

/** One step as it came back: the step, where it stands in the journey, and the response. */
type Returned = { actual: ServerResponse; index: number; step: SpecStep };

/** Judge one step's response against what it states — or, rewriting, say what to write. */
function judgeResponse(
    { actual, index, step }: Returned,
    run: ApiDocumentRun,
    scope: CaptureScope,
): Judgement {
    const { response } = step;
    if (response === null) {
        return { failure: null, rewrite: null };
    }
    const rewriting = shouldUpdateSnapshots() && !run.frozen;
    if (response.kind === 'file') {
        const accessor = new ResponseAccessor(actual, dirname(run.place.filePath), scope);
        const outcome = matchResponseFile(accessor, response.path, run.frozen);
        return {
            failure: outcome.pass ? null : { details: outcome.message(), line: response.line },
            rewrite: null,
        };
    }
    const expected = expectedOf(response, actual);
    if (rewriting) {
        return {
            failure: null,
            rewrite: { ...buildUpdatedResponse(expected, actual), step: index },
        };
    }
    const mismatch = compareResponse(`response of step ${index + 1}`, expected, actual, scope);
    return {
        failure: mismatch === null ? null : { details: mismatch, line: response.line },
        rewrite: null,
    };
}

/** Read every capture a step names out of the body it got back. */
function capture(
    step: SpecStep,
    actual: ServerResponse,
    captured: Map<string, unknown>,
): null | { details: string; line: number } {
    for (const { line, name, path, segments } of step.capture) {
        const value = readJsonPath(actual.body, segments);
        if (value === undefined) {
            return {
                details: `capture: ${name} — ${path} found nothing in the response body:\n${JSON.stringify(actual.body, null, 4)}`,
                line,
            };
        }
        captured.set(name, value);
    }
    return null;
}

/**
 * Run the steps of an api document and resolve with the LAST response — the
 * handle a `.spec.ts` adds its own assertion to after `api.run(file(…))`.
 *
 * Every step is judged the moment it returns: its response, then its tables,
 * then its captures, so a step that diverged stops the journey where it did.
 * Under `TEST_UPDATE=1` an inline response is rewritten from what came back
 * (a file-form one through its golden), and a table is still judged: a row is
 * stated by hand, as `toMatchRows()` states it.
 */
export async function runApiSteps(run: ApiDocumentRun): Promise<ServerResponse> {
    const { document } = run.file;
    const scope = new CaptureScope();
    const captured = new Map<string, unknown>();
    const rewrites: ResponseRewrite[] = [];
    let last: ServerResponse | undefined;
    for (const [index, step] of document.steps.entries()) {
        const request = requestOf(step, run, captured);
        // oxlint-disable-next-line eslint/no-await-in-loop -- a journey is sequential by definition: each step stands on the state the one before it left, and sends what it captured
        const actual = await run.send(request);
        last = actual;
        const judgement = judgeResponse({ actual, index, step }, run, scope);
        // oxlint-disable-next-line eslint/no-await-in-loop -- the tables are read the moment THIS step returned, before the next one moves them
        const tables = await tablesMismatch(step.tables, run.tableOf, scope);
        const failure = judgement.failure ?? tables ?? capture(step, actual, captured);
        if (failure !== null) {
            throw documentFailure({
                action: actionOf(request),
                description: document.description,
                details: failure.details,
                hint: HINT,
                line: failure.line,
                place: run.place,
            });
        }
        if (judgement.rewrite !== null) {
            rewrites.push(judgement.rewrite);
        }
    }
    if (rewrites.length > 0) {
        writeFileSync(run.place.filePath, updateSpecResponses(run.file, rewrites));
    }
    if (last === undefined) {
        throw new Error(`${run.place.displayPath}: an api document sends one request at least`);
    }
    return last;
}
