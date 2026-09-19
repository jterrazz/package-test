import { expect, inject } from 'vitest';

import { GROUND_EXPECTED } from '../../specification/facets/_common/ground.js';
import {
    compareStreamText,
    requireExtension,
    textContains,
    textIsEmpty,
} from '../../specification/facets/_common/result/text-assertions.js';
import { TextAccessor } from '../../specification/facets/_common/result/text.js';
import { readGolden, writeGolden } from './vitest-browser.adapter.js';

/**
 * The matchers, as a page can serve them.
 *
 * The node build reads a golden with `node:fs` and decides update mode from
 * `process.env`/`process.argv`; a page has neither. Everything ELSE is the same
 * assertion — the name-with-extension contract, the `{{token}}` grammar, the
 * diff, the "does not exist" refusal, the update hint — because the comparison
 * lives in `result/text-assertions.ts` and both builds call it. Only the
 * transport differs: two server commands and one `provide`.
 */

type MatcherResult = { message: () => string; pass: boolean };

/** Update mode crosses the seam as a provided value, never as an env read. */
function updating(): boolean {
    return inject('update') === true;
}

async function matchGolden(accessor: TextAccessor, name: string): Promise<MatcherResult> {
    requireExtension(name, 'stream');
    const actual = accessor.comparableText;
    const stored = await readGolden(name);

    if (stored === null) {
        if (updating()) {
            const path = await writeGolden(name, actual);
            return { message: () => `wrote ${path}`, pass: true };
        }
        return {
            message: () =>
                `${accessor.streamName} fixture "${name}" does not exist under ${GROUND_EXPECTED}/ beside this test.\n` +
                'Run with TEST_UPDATE=1 (or vitest -u) to create it.',
            pass: false,
        };
    }

    const comparison = compareStreamText(accessor, name, stored);
    if (!comparison.pass && updating()) {
        await writeGolden(name, actual);
        return { message: () => `updated ${GROUND_EXPECTED}/${name}`, pass: true };
    }
    return comparison;
}

async function toMatch(received: unknown, expected: unknown): Promise<MatcherResult> {
    if (received instanceof TextAccessor) {
        if (typeof expected !== 'string') {
            throw new TypeError(
                'toMatch on accessors takes a fixture name (extension included) — for a regex, assert on the raw text instead: expect(x.text).toMatch(/re/).',
            );
        }
        return await matchGolden(received, expected);
    }
    // Vitest-native semantics for strings (substring or regexp).
    const actual = String(received);
    const pass =
        expected instanceof RegExp ? expected.test(actual) : actual.includes(String(expected));
    return {
        message: () =>
            `expected ${JSON.stringify(actual)} ${pass ? 'not ' : ''}to match ${String(expected)}`,
        pass,
    };
}

function toContain(received: unknown, expected: unknown): MatcherResult {
    if (received instanceof TextAccessor) {
        return textContains(received, String(expected));
    }
    const actual = String(received);
    const pass = actual.includes(String(expected));
    return {
        message: () =>
            `expected ${JSON.stringify(actual)} ${pass ? 'not ' : ''}to contain ${JSON.stringify(expected)}`,
        pass,
    };
}

function toBeEmpty(received: unknown): MatcherResult {
    if (!(received instanceof TextAccessor)) {
        throw new TypeError('toBeEmpty: unsupported subject — expected a text accessor.');
    }
    return textIsEmpty(received);
}

let registered = false;

/**
 * Register the page's matchers with vitest's `expect`. Idempotent, and called
 * from the browser entry itself: a component test imports `@jterrazz/test` to
 * get `component`, and that import IS the registration.
 */
export function registerBrowserMatchers(): void {
    if (registered) {
        return;
    }
    registered = true;
    expect.extend({ toBeEmpty, toContain, toMatch });
}
