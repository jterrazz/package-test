import { describe, expect, test } from 'vitest';

import { owningBodies, withOwnedBody } from './owned-body.js';

/** Its sibling branch is held and never cancelled: msw's shape. */
function teedReply(): Response {
    const source = new Response('{"celsius":21}', {
        headers: { 'x-station': 'north' },
        status: 503,
        statusText: 'Service Unavailable',
    });
    source.clone();
    return source;
}

describe('owned-body', () => {
    test('owned body — the reply handed to the caller — settles a cancel the branch underneath never would', async () => {
        // Given - a reply whose body is a tee branch, owned
        const reply = withOwnedBody(teedReply());

        // Then - the cancel resolves
        await expect(reply.body?.cancel()).resolves.toBeUndefined();
    });

    test('owned body — the reply handed to the caller — reads as the reply it wraps: status, headers, body, address', async () => {
        // Given - a fetch answered with a teed reply, every body owned
        const served = teedReply();
        Object.defineProperty(served, 'url', { value: 'https://weather.test/today' });
        const reply = await owningBodies(async () => served)('https://weather.test/today');

        // Then - what was served, read through the owned stream
        expect([
            reply.status,
            reply.statusText,
            reply.headers.get('x-station'),
            reply.url,
            reply.redirected,
        ]).toStrictEqual([
            503,
            'Service Unavailable',
            'north',
            'https://weather.test/today',
            false,
        ]);
        await expect(reply.json()).resolves.toStrictEqual({ celsius: 21 });
    });

    test('owned body — the reply handed to the caller — hands back a reply with no body as it is', () => {
        // Given - a reply with nothing to own
        const empty = new Response(null, { status: 204 });

        // Then - the same reply
        expect(withOwnedBody(empty)).toBe(empty);
    });
});
