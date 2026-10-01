import { describe, expect, test } from 'vitest';

import { http } from '../kinds/http.js';
import { declared } from './declared.js';

describe('declared', () => {
    test('declared — the stubs one intercept call names — refuses a bare request in the words of the call that wrote it', () => {
        // Given - a request half handed over alone, as only an untyped caller can hand it (the overloads refuse the shape at every typed site)
        const request = http.get('https://weather.test/today');

        // Then - each refusal names both ways to give it its reply, spelled as its caller wrote the call
        expect(() => declared('.intercept', request)).toThrow(
            [
                'found: .intercept(request), a bare request with no response',
                'why: A stub is a request and its response: a request alone answers nothing.',
                'fix: pass a stub — defineStub({ request, response }) — or the inline pair .intercept(request, response)',
                'read: docs/16-stubs.md#using-them-intercept',
            ].join('\n'),
        );
        expect(() => declared('intercept', request)).toThrow(
            [
                'found: intercept(request), a bare request with no response',
                'why: A stub is a request and its response: a request alone answers nothing.',
                'fix: pass a stub — defineStub({ request, response }) — or the inline pair intercept(request, response)',
                'read: docs/16-stubs.md#using-them-intercept',
            ].join('\n'),
        );
    });
});
