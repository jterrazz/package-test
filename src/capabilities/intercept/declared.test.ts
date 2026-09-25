import { describe, expect, test } from 'vitest';

import { http } from '../../stubs/http/http.js';
import { declared } from './declared.js';

describe('declared — the stubs one intercept call names', () => {
    test('refuses a bare request in the words of the call that wrote it', () => {
        // Given - a request half handed over alone, as only an untyped caller can hand it (the overloads refuse the shape at every typed site)
        const request = http.get('https://weather.test/today');

        // Then - each refusal names both ways to give it its reply, spelled as its caller wrote the call
        expect(() => declared('.intercept', request)).toThrow(
            '.intercept(): a bare request needs its response — pass a stub ' +
                '(defineStub({ request, response })) or the inline pair .intercept(request, response).',
        );
        expect(() => declared('intercept', request)).toThrow(
            'intercept(): a bare request needs its response — pass a stub ' +
                '(defineStub({ request, response })) or the inline pair intercept(request, response).',
        );
    });
});
