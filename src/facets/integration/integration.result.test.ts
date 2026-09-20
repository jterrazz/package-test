import { describe, expect, expectTypeOf, test } from 'vitest';

import { JsonAccessor } from '../../model/result/json.js';
import { TextAccessor } from '../../model/result/text.js';
import { CallResult } from './integration.result.js';
import type { CallValue } from './integration.result.js';

/** A result carrying one outcome — every field of the config is optional. */
function resultOf<Returned>(value: unknown): CallResult<Returned> {
    return new CallResult<Returned>({
        config: {},
        outcome: { error: undefined, threw: false, value },
        testDir: import.meta.dirname,
    });
}

describe('callResult — the accessor the value is read through', () => {
    test('reads a string as a stream', () => {
        // Given - a call that returned text
        const result = resultOf<string>('hello');

        // Then - the stream subject, whose reading is the text itself
        expect(result.value).toBeInstanceOf(TextAccessor);
        expect(result.value.text).toBe('hello');
    });

    test('reads anything else as JSON', () => {
        // Given - a call that returned an object
        const result = resultOf<{ ok: boolean }>({ ok: true });

        // Then - the JSON subject, whose reading is the value
        expect(result.value).toBeInstanceOf(JsonAccessor);
        expect(result.value.value).toStrictEqual({ ok: true });
    });

    test('reads a subject that MAY be a string on the value in hand', () => {
        // Given - one subject typed `string | undefined`, answering each way in turn
        const text = resultOf<string | undefined>('hello');
        const absent = resultOf<string | undefined>(null);

        // Then - the accessor follows the value, and the type says both are possible
        expect(text.value).toBeInstanceOf(TextAccessor);
        expect(absent.value).toBeInstanceOf(JsonAccessor);
        expectTypeOf<CallValue<string | undefined>>().toEqualTypeOf<
            JsonAccessor<undefined> | TextAccessor
        >();
    });

    test('types exactly-string as the stream and never-string as JSON', () => {
        // Given - the two unambiguous shapes
        // Then - neither is a union: there is nothing for the test to narrow
        expectTypeOf<CallValue<string>>().toEqualTypeOf<TextAccessor>();
        expectTypeOf<CallValue<number>>().toEqualTypeOf<JsonAccessor<number>>();
    });

    test('a value crosses as the JSON it serialises to, whatever the type claims', () => {
        // Given - a call that returned a Map, which JSON has no shape for
        const result = resultOf<Map<string, number>>(new Map([['a', 1]]));

        // Then - what arrives is plain JSON: a subject answering one of those projects it inside the call
        expect(result.value.value).toStrictEqual({});
    });

    test('reads a call that threw as the empty value, on `error`', () => {
        // Given - a call that refused
        const result = new CallResult<string>({
            config: {},
            outcome: { error: new Error('nope'), threw: true, value: null },
            testDir: import.meta.dirname,
        });

        // Then - there was no value to choose an accessor on, so it is the JSON reading of nothing; what the call produced is the refusal, and that is `error`
        expect(result.value).toBeInstanceOf(JsonAccessor);
        expect(result.error.text).toBe('nope');
    });
});
