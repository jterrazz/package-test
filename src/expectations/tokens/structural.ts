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

/** Captures are recorded in traversal order: arrays left to right, object keys in expected-key order. */
export function structuralEquals(expected: unknown, actual: unknown, scope: CaptureScope): boolean {
    if (expected instanceof Matcher) {
        return matcherMatches(expected, actual, scope);
    }
    if (typeof expected === 'string' && hasPlaceholders(expected)) {
        return placeholderStringMatches(expected, actual, scope);
    }
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || actual.length !== expected.length) {
            return false;
        }
        return expected.every((item, i) => structuralEquals(item, actual[i], scope));
    }
    if (isPlainObject(expected)) {
        if (!isPlainObject(actual)) {
            return false;
        }
        const expectedKeys = Object.keys(expected);
        const actualKeys = Object.keys(actual);
        if (expectedKeys.length !== actualKeys.length) {
            return false;
        }
        return expectedKeys.every(
            (key) => key in actual && structuralEquals(expected[key], actual[key], scope),
        );
    }
    return Object.is(expected, actual);
}

/** Subset match: extra keys on the actual value are allowed; arrays still need equal length. */
export function structuralSubset(expected: unknown, actual: unknown, scope: CaptureScope): boolean {
    if (expected instanceof Matcher) {
        return matcherMatches(expected, actual, scope);
    }
    if (typeof expected === 'string' && hasPlaceholders(expected)) {
        return placeholderStringMatches(expected, actual, scope);
    }
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || actual.length !== expected.length) {
            return false;
        }
        return expected.every((item, i) => structuralSubset(item, actual[i], scope));
    }
    if (isPlainObject(expected)) {
        if (!isPlainObject(actual)) {
            return false;
        }
        return Object.keys(expected).every(
            (key) => key in actual && structuralSubset(expected[key], actual[key], scope),
        );
    }
    return Object.is(expected, actual);
}

export function textEquals(expected: string, actual: string, scope: CaptureScope): boolean {
    if (!hasPlaceholders(expected)) {
        return expected === actual;
    }
    return placeholderStringMatches(expected, actual, scope);
}

/** With placeholders the fixture text becomes an unanchored pattern. */
export function textContains(expected: string, actual: string, scope: CaptureScope): boolean {
    if (!hasPlaceholders(expected)) {
        return actual.includes(expected);
    }
    const parsed = parsePlaceholderString(expected, scope);
    const found = new RegExp(parsed.source, 'u').exec(actual);
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
