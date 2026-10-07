// outside: registered on the first `specification.*` call, through a dynamic `import('vitest')`: the library never imports vitest at load.

import { refusal } from '../../chain/refusals/refusal.js';
import { isDiskDirectory, isDiskFile } from '../../disk/spec-path.js';
import { ContainerAccessor } from '../command/container.js';
import { DirectoryAccessor } from '../disk/directory.js';
import { FilesystemAccessor } from '../disk/filesystem.js';
import { ResponseAccessor } from '../http/response.js';
import { deferRewritesTo } from '../in-place/in-place.js';
import { TableAccessor } from '../table/table.js';
import { JsonAccessor } from '../text/json.js';
import { TextAccessor } from '../text/text.js';
import { matchDirectoryGolden, matchJsonFile, matchStreamFile } from './file-goldens.js';
import type { MatcherResult } from './file-goldens.js';
import type { MatchFixtureOptions } from './match-options.js';
import { matchResponseFile } from './response-goldens.js';
import { isRows, matchTableValue, tableExpectation } from './table-goldens.js';
import {
    emptyStreamRefusal,
    GOLDEN_MATCHER,
    matchThroughGolden,
    streamValueRoute,
    WHOLE_MATCHER,
} from './text-assertions.js';
import type { ValueRoute, WholeCall } from './text-assertions.js';
import {
    matchJsonValue,
    matchResponseValue,
    matchStreamValue,
    unrecorded,
} from './value-goldens.js';
import type { InPlace } from './value-goldens.js';

function toMatchGolden(
    received: unknown,
    expected: unknown,
    options?: MatchFixtureOptions,
): MatcherResult | Promise<MatcherResult> {
    const frozen = options?.frozen === true;
    if (isDiskFile(expected)) {
        if (received instanceof TextAccessor) {
            return matchStreamFile(received, expected.path, frozen);
        }
        if (received instanceof JsonAccessor) {
            return matchJsonFile(received, expected.path, frozen);
        }
        if (received instanceof ResponseAccessor) {
            return matchResponseFile(received, expected.path, frozen);
        }
        throw new TypeError(
            refusal('one-verb-per-meaning', {
                fix: 'compare a stream, a json or a response to its file; a directory or the working directory is `await toMatch(directory(…))`',
                found: `toMatch(file(${JSON.stringify(expected.path)})) on a subject that holds no file of its kind`,
            }),
        );
    }
    if (isDiskDirectory(expected)) {
        return matchDirectoryGolden(received, expected.path, frozen);
    }
    throw new TypeError(
        refusal('one-verb-per-meaning', {
            fix: 'name the golden with file(…) or directory(…)',
            found: `toMatch(${spelledValue(expected)}) routed to the golden comparison`,
        }),
    );
}

function toMatchWhole(
    this: { isNot?: boolean },
    received: unknown,
    expected: unknown,
    call?: WholeCall,
): MatcherResult | Promise<MatcherResult> {
    const context: InPlace = {
        negated: this.isNot === true,
        options: call?.options,
        // Stryker disable next-line StringLiteral: a stack of any text but a test frame's points nowhere to write
        stack: call?.stack ?? '',
    };
    if (received instanceof JsonAccessor) {
        return matchJsonValue(received, expected, context);
    }
    const table = received instanceof TableAccessor ? tableExpectation(expected) : undefined;
    if (received instanceof TableAccessor && table !== undefined) {
        return matchTableValue(received, table, context);
    }
    if (typeof expected !== 'string') {
        throw noValueRefusal(expected);
    }
    if (received instanceof ResponseAccessor) {
        return matchResponseValue(received, expected, context);
    }
    if (received instanceof TextAccessor) {
        return matchStreamValue(received, expected, context);
    }
    throw noValueRefusal(expected);
}

function noValueRefusal(expected: unknown): TypeError {
    return new TypeError(
        refusal('one-verb-per-meaning', {
            fix: 'compare it to its golden, `toMatch(file(…))`, or assert a part of its text with vitest on `.text`',
            found: `toMatch(${spelledValue(expected)}) on a subject that is not compared to a value written in place`,
        }),
    );
}

async function toBeEmpty(received: unknown): Promise<MatcherResult> {
    if (received instanceof TextAccessor) {
        throw emptyStreamRefusal(received);
    }
    if (!(received instanceof TableAccessor)) {
        throw new TypeError(
            refusal('one-verb-per-meaning', {
                fix: "assert a table empty, `await expect(result.table('<name>')).toBeEmpty()`; any other subject is compared whole with toMatch",
                found: 'toBeEmpty() on a subject that is no table',
            }),
        );
    }

    const rows = await received.query(['*']);
    const pass = rows.length === 0;
    return {
        message: () =>
            pass
                ? `expected table "${received.name}" not to be empty`
                : `Expected table "${received.name}" to be empty, but it has ${rows.length} row${rows.length === 1 ? '' : 's'}`,
        pass,
    };
}

async function toBeRunning(received: unknown): Promise<MatcherResult> {
    if (!(received instanceof ContainerAccessor)) {
        throw new TypeError(
            refusal({
                fix: 'assert it on a container accessor: result.container(…) or spec.docker(…)',
                found: 'toBeRunning() on a subject that is no container accessor',
                read: 'docs/reference/assertions.md#container-subjects-docker-aware-cli',
                why: '`toBeRunning()` judges a container.',
            }),
        );
    }

    const pass = received.running;
    return {
        message: () => {
            if (pass) {
                return 'expected container not to be running';
            }
            if (received.exists) {
                return `Expected container to be running, but its status is "${received.status}"`;
            }
            return 'Expected container to be running, but it does not exist';
        },
        pass,
    };
}

function spelledValue(value: unknown): string {
    if (value instanceof RegExp) {
        return 'a RegExp';
    }
    return Array.isArray(value) ? 'an array' : `a ${typeof value}`;
}

function routeValue(subject: unknown, value: unknown): ValueRoute {
    const stream = streamValueRoute(subject, value);
    if (stream !== undefined) {
        return stream;
    }
    if (subject instanceof ResponseAccessor) {
        return typeof value === 'string'
            ? 'whole'
            : new TypeError(
                  refusal('one-verb-per-meaning', {
                      fix: 'write the whole response in place, ``toMatch(`HTTP/1.1 200 OK …`)``, or compare it to toMatch(file(…))',
                      found: `toMatch(${spelledValue(value)}) on a response`,
                  }),
              );
    }
    if (subject instanceof JsonAccessor) {
        return value instanceof RegExp
            ? new TypeError(
                  refusal('one-verb-per-meaning', {
                      fix: 'write the whole value in place, `toMatch({ … })`, or compare it to toMatch(file(…))',
                      found: 'toMatch(a RegExp) on a json',
                  }),
              )
            : 'whole';
    }
    if (subject instanceof TableAccessor) {
        return isRows(value) || unrecorded(value)
            ? 'whole'
            : new TypeError(
                  refusal('one-verb-per-meaning', {
                      fix: "write its rows in place, one array of cells per row in the table's column order: `await expect(result.table('<name>')).toMatch([[…]])`",
                      found: `toMatch(${spelledValue(value)}) on a table`,
                  }),
              );
    }
    if (subject instanceof DirectoryAccessor || subject instanceof FilesystemAccessor) {
        return new TypeError(
            refusal('one-verb-per-meaning', {
                fix: 'compare it to its golden tree: `await expect(…).toMatch(directory(…))`',
                found: `toMatch(${spelledValue(value)}) on a directory`,
            }),
        );
    }
    if (subject instanceof ContainerAccessor) {
        return new TypeError(
            refusal('one-verb-per-meaning', {
                fix: 'assert its state, `await expect(…).toBeRunning()`, or compare its logs, `result.container(…).stdout`, whole',
                found: `toMatch(${spelledValue(value)}) on a container`,
            }),
        );
    }
    return undefined;
}

const REGISTERED = Symbol.for('@jterrazz/test:matchers-registered');

/** Idempotent; a missing vitest peer is tolerated. */
export async function registerMatchers(): Promise<void> {
    // Stryker disable next-line BlockStatement,ConditionalExpression,BooleanLiteral: registering again registers the same matchers
    if (Reflect.get(globalThis, REGISTERED) === true) {
        return;
    }
    // Stryker disable next-line BooleanLiteral,CallExpression: registering again registers the same matchers
    Reflect.set(globalThis, REGISTERED, true);

    try {
        const { chai, expect, inject } = await import('vitest');
        deferRewritesTo(() => inject('inPlaceRewrites'));
        expect.extend({
            [GOLDEN_MATCHER]: toMatchGolden,
            [WHOLE_MATCHER]: toMatchWhole,
            toBeEmpty,
            toBeRunning,
        });
        matchThroughGolden(chai, routeValue);
    } catch {
        Reflect.set(globalThis, REGISTERED, false);
    }
}
