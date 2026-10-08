import { dedent } from '../../../lint/kit/project/dedent.js';
import { refusal } from '../../chain/refusals/refusal.js';
import { parseResponseFile, serializeResponseFile } from '../http/http-file.js';
import type { ResponseAccessor } from '../http/response.js';
import { callSiteOf, writeInPlace } from '../in-place/in-place.js';
import { renderText, renderValue } from '../in-place/render.js';
import { shouldUpdateSnapshots } from '../in-place/update.js';
import type { JsonAccessor } from '../text/json.js';
import type { TextAccessor } from '../text/text.js';
import { renderExpected, structuralEquals } from '../tokens/structural.js';
import {
    mergePreservingPlaceholders,
    mergeTextPreservingPlaceholders,
} from '../tokens/update-merge.js';
import { formatResponseDiff } from './diff.js';
import { failed, passed } from './file-goldens.js';
import type { MatcherResult } from './file-goldens.js';
import type { TableMatchOptions } from './match-options.js';
import { buildUpdatedResponse, compareResponse } from './response-goldens.js';
import { compareStreamInPlace, IN_PLACE } from './text-assertions.js';

export type InPlace = {
    negated: boolean;
    options: TableMatchOptions | undefined;
    stack: string;
};

export const UNRECORDED =
    'nothing is written in place yet — run with TEST_UPDATE=1 (or vitest -u) and the actual value is written into the test.';

export function unrecorded(expected: unknown): boolean {
    return typeof expected === 'string' && expected.trim() === '';
}

export function recordsInPlace(context: InPlace): boolean {
    return shouldUpdateSnapshots() && context.options?.frozen !== true && !context.negated;
}

export function writeAt(context: InPlace, render: (indent: string) => string): MatcherResult {
    const site = callSiteOf(context.stack);
    if (site === undefined) {
        throw new Error(
            refusal({
                fix: 'call toMatch() from the test file itself, or compare to a golden file: toMatch(file(…))',
                found: 'update mode: no frame of this toMatch call is a test file — the value in place has nowhere to be written',
                read: 'docs/reference/tokens.md#a-value-written-in-place-is-rewritten-in-the-test',
                why: 'A value written in place is rewritten in the test that states it.',
            }),
        );
    }
    writeInPlace(site, render);
    return passed(`updated the value in place at ${site.file}:${site.line}`);
}

export function matchStreamValue(
    accessor: TextAccessor,
    expected: string,
    context: InPlace,
): MatcherResult {
    const comparison = compareStreamInPlace(accessor, expected);
    if (comparison.pass || !recordsInPlace(context)) {
        return comparison;
    }
    const merged = mergeTextPreservingPlaceholders(
        dedent(expected),
        accessor.text,
        accessor.captures,
    );
    return writeAt(context, (indent) => renderText(merged, indent));
}

export function matchResponseValue(
    accessor: ResponseAccessor,
    expected: string,
    context: InPlace,
): MatcherResult {
    const previous = unrecorded(expected)
        ? null
        : parseResponseFile(dedent(expected), IN_PLACE, accessor.headers['content-type']);
    const failure =
        previous === null
            ? `Response (${IN_PLACE}): ${UNRECORDED}`
            : compareResponse(IN_PLACE, previous, accessor, accessor.captures);
    if (failure === null) {
        return passed('expected response not to match the value in place');
    }
    if (!recordsInPlace(context)) {
        return failed(failure);
    }
    const updated = buildUpdatedResponse(previous, accessor, accessor.captures.workdir);
    return writeAt(context, (indent) =>
        renderText(serializeResponseFile(updated, accessor.headers['content-type']), indent),
    );
}

export function matchJsonValue(
    accessor: JsonAccessor,
    expected: unknown,
    context: InPlace,
): MatcherResult {
    const actual = accessor.value;
    const empty = unrecorded(expected);
    if (!empty && structuralEquals(expected, actual, accessor.captures)) {
        return passed('expected JSON not to match the value in place');
    }
    if (!recordsInPlace(context)) {
        return failed(
            empty
                ? `JSON (${IN_PLACE}): ${UNRECORDED}`
                : formatResponseDiff(IN_PLACE, renderExpected(expected), actual),
        );
    }
    const merged = mergePreservingPlaceholders(
        empty ? null : renderExpected(expected),
        actual,
        accessor.captures.workdir,
    );
    return writeAt(context, (indent) => renderValue(merged, indent));
}
