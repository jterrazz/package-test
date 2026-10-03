import type { CaptureScope } from './capture-scope.js';
import { Matcher } from './match.js';
import {
    hasPlaceholders,
    matcherMatches,
    parsePlaceholderString,
    placeholderStringMatches,
    recordRef,
} from './placeholders.js';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Captures are recorded in traversal order: arrays left to right, object keys in expected-key order. A subset allows the actual object keys the expected does not state; arrays need equal length either way. */
function structurally(
    expected: unknown,
    actual: unknown,
    scope: CaptureScope,
    subset: boolean,
): boolean {
    if (expected instanceof Matcher) {
        return matcherMatches(expected, actual, scope);
    }
    if (typeof expected === 'string' && hasPlaceholders(expected)) {
        return placeholderStringMatches(expected, actual, scope);
    }
    if (Array.isArray(expected)) {
        return (
            Array.isArray(actual) &&
            actual.length === expected.length &&
            expected.every((item, index) => structurally(item, actual[index], scope, subset))
        );
    }
    if (isPlainObject(expected)) {
        return (
            isPlainObject(actual) &&
            (subset || Object.keys(actual).length === Object.keys(expected).length) &&
            Object.keys(expected).every(
                (key) => key in actual && structurally(expected[key], actual[key], scope, subset),
            )
        );
    }
    return Object.is(expected, actual);
}

export function structuralEquals(expected: unknown, actual: unknown, scope: CaptureScope): boolean {
    return structurally(expected, actual, scope, false);
}

export function structuralSubset(expected: unknown, actual: unknown, scope: CaptureScope): boolean {
    return structurally(expected, actual, scope, true);
}

/** A text without tokens reads as itself, every character literal. */
export function textEquals(expected: string, actual: string, scope: CaptureScope): boolean {
    return placeholderStringMatches(expected, actual, scope);
}

const UNICODE = 'u';

/** The fixture text becomes an unanchored pattern, a text without tokens a literal one. */
export function textContains(expected: string, actual: string, scope: CaptureScope): boolean {
    const parsed = parsePlaceholderString(expected, scope);
    const found = new RegExp(parsed.source, UNICODE).exec(actual);
    if (!found) {
        return false;
    }
    return parsed.refs.every(
        (entry) => entry.ref === undefined || recordRef(entry.ref, found[entry.index + 1], scope),
    );
}

export function renderExpected(value: unknown): unknown {
    if (value instanceof Matcher) {
        return value.toString();
    }
    if (Array.isArray(value)) {
        return value.map((item) => renderExpected(item));
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, renderExpected(item)]),
        );
    }
    return value;
}
