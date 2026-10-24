import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { resolveSpecPath } from '../../disk/resolved-spec-path.js';
import {
    parseResponseFile,
    serializeResponseFile,
    unreachableLine,
    unreachableResponse,
} from '../http/http-file.js';
import type { ParsedResponseFile } from '../http/http-file.js';
import { DEFAULT_RECORDING } from '../http/response.js';
import type { ResponseAccessor, ResponseRecording } from '../http/response.js';
import { missingHint, shouldUpdateSnapshots } from '../in-place/update.js';
import { CaptureScope } from '../tokens/capture-scope.js';
import { renderExpected, structuralEquals } from '../tokens/structural.js';
import { mergePreservingPlaceholders } from '../tokens/update-merge.js';
import { formatResponseDiff } from './diff.js';
import { failed, passed, recordedGolden } from './file-goldens.js';
import type { MatcherResult } from './file-goldens.js';
import { requireExtension } from './text-assertions.js';

const STATUS_CODE = /^\d+$/u;

type ActualResponse = {
    body: unknown;
    headers: Record<string, string>;
    recording?: ResponseRecording | undefined;
    status: number;
    unreachable?: string | undefined;
};

const outcomeOf = (response: {
    status: number | string;
    unreachable?: string | undefined;
}): string =>
    response.unreachable === undefined
        ? `HTTP/1.1 ${response.status}`
        : unreachableLine(response.unreachable);

// invariant: a reason the golden held keeps its tokens while it still matches.
function updatedUnreachable(
    previous: null | ParsedResponseFile,
    reason: string,
    scope: CaptureScope,
): ParsedResponseFile {
    const kept =
        previous?.unreachable !== undefined && structuralEquals(previous.unreachable, reason, scope)
            ? previous.unreachable
            : reason;
    return unreachableResponse(kept);
}

// invariant: a golden's headers are kept where they still match, and a fresh one records the selection the response carries.
function updatedHeaders(
    previous: null | ParsedResponseFile,
    actual: ActualResponse,
    scope: CaptureScope,
): Record<string, string> {
    const headers: Record<string, string> = {};
    if (previous === null) {
        for (const name of (actual.recording ?? DEFAULT_RECORDING).headers) {
            const actualValue = actual.headers[name.toLowerCase()];
            if (actualValue !== undefined) {
                headers[name.toLowerCase()] = actualValue;
            }
        }
        return headers;
    }
    for (const [key, value] of Object.entries(previous.headers)) {
        const actualValue = actual.headers[key.toLowerCase()];
        if (actualValue !== undefined) {
            headers[key] = structuralEquals(value, actualValue, scope) ? value : actualValue;
        }
    }
    return headers;
}

// invariant: a body the golden held keeps its tokens; a golden stating none keeps stating none when the recording says so.
function updatedBody(
    previous: null | ParsedResponseFile,
    actual: ActualResponse,
    workdir: string | undefined,
): Pick<ParsedResponseFile, 'body' | 'hasBody'> {
    const keptAbsent =
        (actual.recording ?? DEFAULT_RECORDING).bodyKeptAbsent && previous?.hasBody === false;
    const hasBody = !keptAbsent && actual.body !== null && actual.body !== undefined;
    const body =
        previous?.hasBody === true && hasBody
            ? mergePreservingPlaceholders(previous.body, actual.body, workdir)
            : mergePreservingPlaceholders(null, actual.body, workdir);
    return { body, hasBody };
}

/** Headers are the intersection with the actual response, so a freshly updated fixture passes the next run. */
export function buildUpdatedResponse(
    stated: null | ParsedResponseFile,
    actual: ActualResponse,
    workdir?: string,
): ParsedResponseFile {
    const scope = new CaptureScope();
    if (actual.unreachable !== undefined) {
        return updatedUnreachable(stated, actual.unreachable, scope);
    }
    // invariant: a golden that stated an exchange never answered states nothing of the one that did.
    const previous = stated?.unreachable === undefined ? stated : null;
    const status =
        previous && structuralEquals(previous.status, String(actual.status), scope)
            ? previous.status
            : String(actual.status);
    return {
        ...updatedBody(previous, actual, workdir),
        headers: updatedHeaders(previous, actual, scope),
        status,
    };
}

// invariant: an unreachable outcome is compared as its one line, against a status line or another reason.
function compareOutcome(
    name: string,
    expected: ParsedResponseFile,
    actual: ActualResponse,
    scope: CaptureScope,
): null | string {
    return structuralEquals(expected.unreachable, actual.unreachable, scope)
        ? null
        : `Response outcome mismatch (${name})\n` +
              `  expected: ${outcomeOf(expected)}\n` +
              `  received: ${outcomeOf(actual)}`;
}

export function compareResponse(
    name: string,
    expected: ParsedResponseFile,
    actual: ActualResponse,
    scope: CaptureScope,
): null | string {
    if (expected.unreachable !== undefined || actual.unreachable !== undefined) {
        return compareOutcome(name, expected, actual, scope);
    }
    const statusOk = STATUS_CODE.test(expected.status)
        ? Number(expected.status) === actual.status
        : structuralEquals(expected.status, String(actual.status), scope);
    if (!statusOk) {
        return (
            `Response status mismatch (${name})\n` +
            `  expected: ${expected.status}\n` +
            `  received: ${actual.status}`
        );
    }

    // invariant: subset semantics: only the headers the fixture lists are asserted.
    for (const [key, value] of Object.entries(expected.headers)) {
        const actualValue = actual.headers[key.toLowerCase()];
        if (actualValue === undefined || !structuralEquals(value, actualValue, scope)) {
            return (
                `Response header mismatch (${name})\n` +
                `  header: ${key}\n` +
                `  expected: ${value}\n` +
                `  received: ${actualValue ?? '(absent)'}`
            );
        }
    }

    if (expected.hasBody && !structuralEquals(expected.body, actual.body, scope)) {
        return formatResponseDiff(name, renderExpected(expected.body), actual.body);
    }

    return null;
}

export function matchResponseFile(
    accessor: ResponseAccessor,
    name: string,
    frozen: boolean,
): MatcherResult {
    requireExtension(name, 'response');
    const filePath = resolveSpecPath('toMatch', name, accessor.testDir);

    if (shouldUpdateSnapshots() && !frozen) {
        const recorded = recordedGolden(filePath);
        const previous =
            recorded === null
                ? null
                : parseResponseFile(recorded, name, accessor.headers['content-type']);

        const updated = buildUpdatedResponse(previous, accessor, accessor.captures.workdir);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, serializeResponseFile(updated, accessor.headers['content-type']));
        return passed(`updated ${name}`);
    }

    if (!existsSync(filePath)) {
        return failed(
            `Response fixture "${name}" does not exist at ${filePath}.\n${missingHint(frozen)}`,
        );
    }

    const expected = parseResponseFile(
        readFileSync(filePath, 'utf8'),
        name,
        accessor.headers['content-type'],
    );
    const failure = compareResponse(name, expected, accessor, accessor.captures);
    return failure === null ? passed(`expected response not to match ${name}`) : failed(failure);
}
