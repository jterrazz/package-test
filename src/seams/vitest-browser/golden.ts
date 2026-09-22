import { expect, inject } from 'vitest';

import { requireRelativePath } from '../../model/chain/spec-path.js';
import type { MatchFixtureOptions } from '../../model/result/match-options.js';
import {
    compareStreamText,
    nativeContain,
    nativeMatch,
    requireExtension,
    textContains,
    textIsEmpty,
} from '../../model/result/text-assertions.js';
import { TextAccessor } from '../../model/result/text.js';
import { readGolden, writeGolden } from './vitest-browser.adapter.js';

/**
 * The matchers, as a page can serve them.
 *
 * The node build reads a golden with `node:fs` and decides update mode from
 * `process.env`/`process.argv`; a page has neither. Everything ELSE is the same
 * assertion — the name-with-extension contract, the `{{token}}` grammar, the
 * diff, the "does not exist" refusal, the update hint, `{ frozen: true }` —
 * because the comparison lives in `result/text-assertions.ts` and both builds
 * call it. Only the transport differs: two server commands and one `provide`.
 */

type MatcherResult = { message: () => string; pass: boolean };

/** Update mode crosses the seam as a provided value, never as an env read. */
function updating(): boolean {
    return inject('update') === true;
}

async function matchGolden(
    accessor: TextAccessor,
    name: string,
    frozen: boolean,
): Promise<MatcherResult> {
    requireExtension(name, 'stream');
    const actual = accessor.comparableText;
    const stored = await readGolden(name);

    if (stored === null) {
        if (updating() && !frozen) {
            const path = await writeGolden(name, actual);
            return { message: () => `wrote ${path}`, pass: true };
        }
        return {
            message: () =>
                `${accessor.streamName} fixture "${name}" does not exist beside this test.\n` +
                'Run with TEST_UPDATE=1 (or vitest -u) to create it.',
            pass: false,
        };
    }

    const comparison = compareStreamText(accessor, name, stored);
    if (!comparison.pass && updating() && !frozen) {
        await writeGolden(name, actual);
        return { message: () => `updated ${name}`, pass: true };
    }
    return comparison;
}

async function toMatchFile(
    received: unknown,
    expected: unknown,
    options?: MatchFixtureOptions,
): Promise<MatcherResult> {
    requireRelativePath('toMatchFile', expected);
    if (!(received instanceof TextAccessor)) {
        throw new TypeError(
            'toMatchFile: unsupported subject — in a page, a golden file is compared against a captured text (result.tree, result.html, text(…)).',
        );
    }
    return await matchGolden(received, expected, options?.frozen === true);
}

/** Vitest's `toMatch`, reading a stream accessor as the text it compares. */
function toMatch(received: unknown, expected: unknown): MatcherResult {
    if (received instanceof TextAccessor) {
        return nativeMatch(received.comparableText, expected);
    }
    return nativeMatch(received, expected);
}

function toContain(received: unknown, expected: unknown): MatcherResult {
    if (received instanceof TextAccessor) {
        return textContains(received, String(expected));
    }
    return nativeContain(received, expected);
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
    expect.extend({ toBeEmpty, toContain, toMatch, toMatchFile });
}
