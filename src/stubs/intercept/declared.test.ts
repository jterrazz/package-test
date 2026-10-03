import { describe, expect, test } from 'vitest';

import { http } from '../kinds/http.js';
import { defineStub, defineStubs } from '../stub.js';
import { declared } from './declared.js';

const TODAY = defineStub({
    request: http.get('https://weather.test/today'),
    response: http.json({ celsius: 21 }),
});

const TOMORROW = defineStub({
    request: http.get('https://weather.test/tomorrow'),
    response: http.json({ celsius: 19 }),
});

function refused(call: '.intercept' | 'intercept'): string {
    return [
        `found: ${call}(request), a bare request with no response`,
        'why: A stub is a request and its response: a request alone answers nothing.',
        `fix: pass a stub — defineStub({ request, response }) — or the inline pair ${call}(request, response)`,
        'read: docs/17-stubs.md#using-them-intercept',
    ].join('\n');
}

describe('declared', () => {
    test('declared — takes a stub, a list, a composite and an inline pair alike, each as its stubs', () => {
        // Given - each form a declaration takes
        // Then - the stubs each stands for
        expect([
            declared('intercept', TODAY),
            declared('intercept', [TODAY, TOMORROW]),
            declared('.intercept', defineStubs(TODAY, TOMORROW)),
            declared('intercept', TODAY.request, TODAY.response),
        ]).toStrictEqual([[TODAY], [TODAY, TOMORROW], [TODAY, TOMORROW], [TODAY]]);
    });

    test('declared — refuses a request with no response, in the words of the call that wrote it', () => {
        // Given - a request handed alone to each call
        // Then - each refusal names its call
        expect(() => declared('intercept', TODAY.request)).toThrow(new Error(refused('intercept')));
        expect(() => declared('.intercept', TODAY.request)).toThrow(
            new Error(refused('.intercept')),
        );
    });
});
