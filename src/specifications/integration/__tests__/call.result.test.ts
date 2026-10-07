import { describe, expect, expectTypeOf, test } from 'vitest';

import type { JsonAccessor } from '../../../expectations/text/json.js';
import { TextAccessor } from '../../../expectations/text/text.js';
import { CallResult } from '../call.result.js';
import type { CallOutcome, CallValue } from '../call.result.js';

type Read = { error: string; value: { json: unknown } | { stream: string } };

function readOf(outcome: CallOutcome): Read {
    const result = new CallResult<null | object | string>({
        config: {},
        outcome,
        testDir: import.meta.dirname,
    });
    const { value } = result;
    return {
        error: result.error.text,
        value: value instanceof TextAccessor ? { stream: value.text } : { json: value.value },
    };
}

const returned = (value: unknown): CallOutcome => ({ error: undefined, threw: false, value });

describe('CallResult', () => {
    test('callResult — the accessor the value is read through — reads a string as a stream, and no error', () => {
        // Given - a call that returned text
        // Then - the stream subject, whose reading is the text itself
        expect(readOf(returned('hello'))).toStrictEqual({ error: '', value: { stream: 'hello' } });
    });

    test('callResult — the accessor the value is read through — reads anything else as JSON, and no error', () => {
        // Given - a call that returned an object, and one that returned null
        // Then - the JSON subject, whose reading is the value
        expect([readOf(returned({ ok: true })), readOf(returned(null))]).toStrictEqual([
            { error: '', value: { json: { ok: true } } },
            { error: '', value: { json: null } },
        ]);
    });

    test('callResult — the accessor the value is read through — types exactly-string as the stream, never-string as JSON, and maybe-string as either', () => {
        // Given - the three shapes a call's return type takes
        // Then - only the ambiguous one is a union for the test to narrow
        expectTypeOf<CallValue<string>>().toEqualTypeOf<TextAccessor>();
        expectTypeOf<CallValue<number>>().toEqualTypeOf<JsonAccessor<number>>();
        expectTypeOf<CallValue<string | undefined>>().toEqualTypeOf<
            JsonAccessor<undefined> | TextAccessor
        >();
    });

    test('callResult — the accessor the value is read through — a value crosses as the JSON it serialises to, whatever the type claims', () => {
        // Given - a call that returned a Map, which JSON has no shape for
        // Then - what arrives is plain JSON: a subject answering one of those projects it inside the call
        const map = new Map([['a', 1]]);
        expect(readOf(returned(map))).toStrictEqual({
            error: '',
            value: { json: {} },
        });
    });

    test('callResult — the accessors — each named for what it reads, and every one binding captures in the result’s one scope', () => {
        // Given - a call that returned text, and one that returned JSON
        const text = new CallResult<string>({
            config: {},
            outcome: returned('hi'),
            testDir: '/spec',
        });
        const json = new CallResult({ config: {}, outcome: returned({}), testDir: '/spec' });
        const { error, value } = text;

        // Then - the stream names a golden and a refusal read, and the shared scope
        expect([
            error.streamName,
            value.streamName,
            error.captures === text.captures,
            value.captures === text.captures,
            json.value.captures === json.captures,
        ]).toStrictEqual(['error', 'value', true, true, true]);
    });

    test('callResult — the accessor the value is read through — reads a call that threw as the empty value, its refusal on `error`', () => {
        // Given - a call that refused with an error, and one that threw a bare value
        // Then - there was no value to choose an accessor on, so it is the JSON reading of nothing; what the call produced is the refusal
        expect([
            readOf({ error: new Error('nope'), threw: true, value: null }),
            readOf({ error: 'declined', threw: true, value: 'ignored' }),
        ]).toStrictEqual([
            { error: 'nope', value: { json: null } },
            { error: 'declined', value: { json: null } },
        ]);
    });
});
