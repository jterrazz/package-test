import { describe, expect, test } from 'vitest';

import { api } from '../deployed.specification.js';

const refused = (name: string): string =>
    [
        `found: .${name}() on the chain of specification.api({ url })`,
        'why: A deployed api runs elsewhere: its database, its outbound network and its clock are its own, so its chain offers what a request can do, and a request other than a GET is written whole.',
        'fix: seed, stub and pin the app with `server`, in this process; against a `url`, send the request (`.get()`, `.request()`) and compare the response',
        'read: docs/guides/api-specs.md#deployed-target-url',
    ].join('\n');

describe('in-process', () => {
    test('a setup that reaches into the app is refused on a deployed api, for a caller the types do not reach', () => {
        // Given - a deployed api, its chain past a header, asked for what only an app built here takes (the type has neither)
        const chain = api.headers({ 'x-probe': 'a' });

        // Then - each refused in the words of the target, before any request
        expect('seed' in chain || 'clock' in api).toBe(false);
        const seed: unknown = Reflect.get(chain, 'seed');
        const clock: unknown = Reflect.get(api, 'clock');
        expect(seed).toThrow(refused('seed'));
        expect(clock).toThrow(refused('clock'));
    });
});
