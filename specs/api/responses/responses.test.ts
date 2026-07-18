import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

// ── Placeholders in expected/*.http — both modes ──

describe('responses', () => {
    test('matches dynamic values via placeholders', async () => {
        // Given - an endpoint returning a random uuid and a timestamp
        const result = await api.get('/session');

        // Then - the fixture matches via {{uuid#session}} / {{iso8601}} placeholders,
        // With the #session ref asserting both uuid occurrences are equal.
        // The matcher also asserts the status line and the content-type header (via a
        // {{string}} placeholder) as a subset — headers absent from the fixture are unconstrained.
        expect(result.response).toMatch('session.http');
    });

    test('fails when a ref captures two different values', async () => {
        // Given - a fixture that reuses one ref for fields with different values
        const result = await api.get('/session');

        // Then - the second occurrence of {{...#val}} must equal the capture, and does not
        // Frozen - a deliberately-wrong fixture asserting the mismatch; never rewritten under TEST_UPDATE
        expect(() =>
            expect(result.response).toMatch('session-wrong-ref.http', { frozen: true }),
        ).toThrow(/Response mismatch/);
    });
});

describe('response mismatch messages', () => {
    test('reports a status-line mismatch with expected and received codes', async () => {
        // Given - a fixture expecting 201 for an endpoint that returns 200
        const result = await api.get('/session');

        // Then - the failure names the fixture and both status codes
        // Frozen - a deliberately-wrong fixture asserting the status mismatch; never rewritten under TEST_UPDATE
        expect(() =>
            expect(result.response).toMatch('session-wrong-status.http', { frozen: true }),
        ).toThrow(
            /Response status mismatch \(session-wrong-status\.http\)[\s\S]*expected: 201[\s\S]*received: 200/,
        );
    });

    test('reports a subset-header mismatch with the wrong value', async () => {
        // Given - a fixture pinning content-type to a value the app never sends
        const result = await api.get('/session');

        // Then - the failure names the header and shows expected vs received
        // Frozen - a deliberately-wrong fixture asserting the header mismatch; never rewritten under TEST_UPDATE
        expect(() =>
            expect(result.response).toMatch('session-wrong-header.http', { frozen: true }),
        ).toThrow(
            /Response header mismatch \(session-wrong-header\.http\)[\s\S]*header: content-type[\s\S]*expected: text\/html[\s\S]*received: application\/json/,
        );
    });

    test('reports a subset-header mismatch when the header is absent', async () => {
        // Given - a fixture listing a header the response does not carry
        const result = await api.get('/session');

        // Then - the failure shows the header as absent
        // Frozen - a deliberately-wrong fixture asserting the absent-header case; never rewritten under TEST_UPDATE
        expect(() =>
            expect(result.response).toMatch('session-missing-header.http', { frozen: true }),
        ).toThrow(
            /Response header mismatch \(session-missing-header\.http\)[\s\S]*header: x-request-id[\s\S]*received: \(absent\)/,
        );
    });
});
