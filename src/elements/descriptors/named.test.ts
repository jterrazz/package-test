import { describe, expect, test } from 'vitest';

import { named, optionallyNamed } from './named.js';

describe('named', () => {
    test('named — omits exact when it was not asked for', () => {
        // Given - a descriptor built without options
        const element = named('button')('Subscribe');

        // Then - the default stays absent rather than false, so refs compare cleanly
        expect(element).toStrictEqual({ kind: 'button', name: 'Subscribe' });
    });

    test('named — carries exact when asked for', () => {
        // Given - a descriptor asking for a whole-name match
        const element = named('field')('Email', { exact: true });

        // Then - the flag travels with the descriptor
        expect(element).toStrictEqual({ exact: true, kind: 'field', name: 'Email' });
    });

    test('optionallyNamed — omits the name it was not given', () => {
        // Given - a region built without a name
        const element = optionallyNamed('main')();

        // Then - it designates the region itself, not an empty-named one
        expect(element).toStrictEqual({ kind: 'main' });
    });

    test('optionallyNamed — carries exact when asked for', () => {
        // Given - a named region opting out of the whole-name match
        const element = optionallyNamed('region')('Series', { exact: false });

        // Then - the stated flag travels with the descriptor
        expect(element).toStrictEqual({ exact: false, kind: 'region', name: 'Series' });
    });
});
