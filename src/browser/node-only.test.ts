import { describe, expect, test } from 'vitest';

import { nodeOnlyClass, refuse } from './node-only.js';

describe('the page refuses what only node can do, where it was called', () => {
    test('names the binding and says where it runs', () => {
        // Given - a service the page has no socket for
        // Then - the refusal names it and the runtime that has one
        expect(() => refuse('postgres()')).toThrow(/^postgres\(\) runs under node/u);
    });

    test('routes a rendered thing to the kind that renders', () => {
        // Given - any node-only binding reached from a page
        const message = (() => {
            try {
                refuse('specification.website()');
            } catch (error) {
                return error instanceof Error ? error.message : '';
            }
            return '';
        })();

        // Then - the refusal says where a rendered thing is specified instead
        expect(message).toContain('a rendered thing is a `.test.tsx` beside its component');
    });

    test('a node-only class is present and throws when it is constructed', () => {
        // Given - a result class the page can name but never build
        const Stub = nodeOnlyClass('CliResult');

        // Then - the name resolves, and using it is what fails
        expect(Stub).toBeTypeOf('function');
    });
});
