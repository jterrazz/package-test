import { expect, test, vi } from 'vitest';

const realFetch = globalThis.fetch;

test('a test stubs a spy, a variable and a global, and cleans none of them up', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.stubEnv('REGION', 'eu-west-3');
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('stubbed')));

    expect([Math.random(), process.env.REGION]).toStrictEqual([0.5, 'eu-west-3']);
});

test('the next test finds the real ones', () => {
    expect([vi.isMockFunction(Math.random), process.env.REGION, globalThis.fetch]).toStrictEqual([
        false,
        undefined,
        realFetch,
    ]);
});
