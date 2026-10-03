import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { resolveSpecPath } from '../../disk/resolved-spec-path.js';
import { parseResponseFile, serializeResponseFile } from '../http/http-file.js';
import type { ParsedResponseFile } from '../http/http-file.js';
import type { ResponseAccessor } from '../http/response.js';
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
    status: number;
};

/** Headers are the intersection with the actual response, so a freshly updated fixture passes the next run. */
export function buildUpdatedResponse(
    previous: null | ParsedResponseFile,
    actual: ActualResponse,
    workdir?: string,
): ParsedResponseFile {
    const scope = new CaptureScope();
    const status =
        previous && structuralEquals(previous.status, String(actual.status), scope)
            ? previous.status
            : String(actual.status);

    const headers: Record<string, string> = {};
    if (previous) {
        for (const [key, value] of Object.entries(previous.headers)) {
            const actualValue = actual.headers[key.toLowerCase()];
            if (actualValue === undefined) {
                continue;
            }
            headers[key] = structuralEquals(value, actualValue, scope) ? value : actualValue;
        }
    } else if (actual.headers['content-type'] !== undefined) {
        headers['content-type'] = actual.headers['content-type'];
    }

    const hasBody = actual.body !== null && actual.body !== undefined;
    const body =
        previous?.hasBody === true && hasBody
            ? mergePreservingPlaceholders(previous.body, actual.body, workdir)
            : mergePreservingPlaceholders(null, actual.body, workdir);

    return { body, hasBody, headers, status };
}

export function compareResponse(
    name: string,
    expected: ParsedResponseFile,
    actual: ActualResponse,
    scope: CaptureScope,
): null | string {
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
