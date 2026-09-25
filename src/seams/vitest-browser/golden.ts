import { chai, expect, inject } from 'vitest';

import { isDiskFile } from '../../model/chain/spec-path.js';
import type { MatchFixtureOptions } from '../../model/goldens/match-options.js';
import {
    compareStreamInPlace,
    compareStreamText,
    emptyStreamRefusal,
    GOLDEN_MATCHER,
    matchThroughGolden,
    requireExtension,
    streamValueRoute,
    WHOLE_MATCHER,
} from '../../model/goldens/text-assertions.js';
import type { WholeCall } from '../../model/goldens/text-assertions.js';
import { refusal } from '../../model/lesson/refusal.js';
import { dedent } from '../../model/matching/dedent.js';
import { mergeTextPreservingPlaceholders } from '../../model/matching/structural.js';
import { TextAccessor } from '../../results/text.js';
import { readGolden, writeGolden, writeInPlaceText } from './vitest-browser.adapter.js';

/**
 * The matchers, as a page can serve them.
 *
 * The node build reads a golden with `node:fs` and decides update mode from
 * `process.env`/`process.argv`; a page has neither. Everything ELSE is the same
 * assertion — the name-with-extension contract, the `{{token}}` grammar, the
 * diff, the "does not exist" refusal, the update hint, `{ frozen: true }` —
 * because the comparison lives in `goldens/text-assertions.ts` and both builds
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
    const actual = accessor.text;
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

/** `toMatch(file())` in a page — a golden file against a captured text; a directory golden is node's. */
async function toMatchGolden(
    received: unknown,
    expected: unknown,
    options?: MatchFixtureOptions,
): Promise<MatcherResult> {
    if (!isDiskFile(expected)) {
        throw new TypeError(
            refusal('d14-one-verb-per-meaning', {
                fix: 'compare the tree under node, or a captured text of the page to its file(…)',
                found: 'toMatch(directory(…)) in a page, which has no working directory',
            }),
        );
    }
    if (!(received instanceof TextAccessor)) {
        throw new TypeError(
            refusal('d14-one-verb-per-meaning', {
                fix: `compare a captured text — result.tree, result.html, text(…) — to file(${JSON.stringify(expected.path)})`,
                found: `toMatch(file(${JSON.stringify(expected.path)})) in a page, on a subject that is no captured text`,
            }),
        );
    }
    return await matchGolden(received, expected.path, options?.frozen === true);
}

/**
 * `toMatch(<text>)` in a page — a captured text against the text written in
 * place, rewritten in the test's source by update mode through a server
 * command. Awaited, as every comparison a page makes is.
 */
async function toMatchWhole(
    this: { isNot?: boolean },
    received: unknown,
    expected: unknown,
    call?: WholeCall,
): Promise<MatcherResult> {
    if (!(received instanceof TextAccessor) || typeof expected !== 'string') {
        throw new TypeError(
            refusal('d14-one-verb-per-meaning', {
                fix: 'compare a captured text — result.tree, result.html, text(…) — to a text written in place',
                found: 'toMatch(<value>) in a page, on a subject or a value that is no text',
            }),
        );
    }
    const comparison = compareStreamInPlace(received, expected);
    const frozen = call?.options?.frozen === true;
    if (comparison.pass || !updating() || frozen || this.isNot === true) {
        return comparison;
    }
    const previous = dedent(expected);
    const merged = mergeTextPreservingPlaceholders(
        previous === '' ? null : previous,
        received.text,
        received.captures,
    );
    const where = await writeInPlaceText(call?.stack ?? '', merged);
    return { message: () => `updated the value in place at ${where}`, pass: true };
}

/** A page holds no table: `toBeEmpty` is registered to refuse a stream with the form to write. */
async function toBeEmpty(received: unknown): Promise<MatcherResult> {
    return await Promise.reject(
        received instanceof TextAccessor
            ? emptyStreamRefusal(received)
            : new TypeError(
                  refusal('d14-one-verb-per-meaning', {
                      fix: "compare the stream's text: expect(<result>.<stream>.text).toBe('')",
                      found: 'toBeEmpty() in a page, which holds no table',
                  }),
              ),
    );
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
    expect.extend({ [GOLDEN_MATCHER]: toMatchGolden, [WHOLE_MATCHER]: toMatchWhole, toBeEmpty });
    matchThroughGolden(chai, streamValueRoute);
}
