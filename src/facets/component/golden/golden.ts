import { chai, expect, inject } from 'vitest';

import { dedent } from '../../../../lint/engine/project/dedent.js';
import { refusal } from '../../../../lint/index.refusal.js';
import type { MatchFixtureOptions } from '../../../expectations/goldens/match-options.js';
import {
    compareStreamInPlace,
    compareStreamText,
    emptyStreamRefusal,
    GOLDEN_MATCHER,
    matchThroughGolden,
    requireExtension,
    streamValueRoute,
    WHOLE_MATCHER,
} from '../../../expectations/goldens/text-assertions.js';
import type { WholeCall } from '../../../expectations/goldens/text-assertions.js';
import { missingHint } from '../../../expectations/in-place/update.js';
import { TextAccessor } from '../../../expectations/text/text.js';
import { mergeTextPreservingPlaceholders } from '../../../expectations/tokens/structural.js';
import { isDiskFile } from '../../../kernel/files/spec-path.js';
import { readGolden, writeGolden, writeInPlaceText } from '../page/vitest-browser-dom.js';

/** The comparison is `goldens/text-assertions.ts`'s in both builds; only the transport differs: two server commands and one `provide`. */

type MatcherResult = { message: () => string; pass: boolean };

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
                `${accessor.streamName} fixture "${name}" does not exist beside this test.\n${missingHint(
                    frozen,
                )}`,
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

async function toMatchGolden(
    received: unknown,
    expected: unknown,
    options?: MatchFixtureOptions,
): Promise<MatcherResult> {
    if (!isDiskFile(expected)) {
        throw new TypeError(
            refusal('one-verb-per-meaning', {
                fix: 'compare the tree under node, or a captured text of the page to its file(…)',
                found: 'toMatch(directory(…)) in a page, which has no working directory',
            }),
        );
    }
    if (!(received instanceof TextAccessor)) {
        throw new TypeError(
            refusal('one-verb-per-meaning', {
                fix: `compare a captured text — result.tree, result.html, text(…) — to file(${JSON.stringify(expected.path)})`,
                found: `toMatch(file(${JSON.stringify(expected.path)})) in a page, on a subject that is no captured text`,
            }),
        );
    }
    return await matchGolden(received, expected.path, options?.frozen === true);
}

async function toMatchWhole(
    this: { isNot?: boolean },
    received: unknown,
    expected: unknown,
    call?: WholeCall,
): Promise<MatcherResult> {
    if (!(received instanceof TextAccessor) || typeof expected !== 'string') {
        throw new TypeError(
            refusal('one-verb-per-meaning', {
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

async function toBeEmpty(received: unknown): Promise<MatcherResult> {
    return await Promise.reject(
        received instanceof TextAccessor
            ? emptyStreamRefusal(received)
            : new TypeError(
                  refusal('one-verb-per-meaning', {
                      fix: "compare the stream's text: expect(<result>.<stream>.text).toBe('')",
                      found: 'toBeEmpty() in a page, which holds no table',
                  }),
              ),
    );
}

let registered = false;

/** Idempotent; the browser entry's import is the registration. */
export function registerBrowserMatchers(): void {
    if (registered) {
        return;
    }
    registered = true;
    expect.extend({ [GOLDEN_MATCHER]: toMatchGolden, [WHOLE_MATCHER]: toMatchWhole, toBeEmpty });
    matchThroughGolden(chai, streamValueRoute);
}
