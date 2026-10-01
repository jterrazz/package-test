import { describe, expect, test } from 'vitest';

import { nodeOnlyClass, refuse } from './node-only.js';

describe('node-only', () => {
    test('the page refuses what only node can do, where it was called — names the binding and says where it runs', () => {
        // Given - a service the page has no socket for
        // Then - the refusal names it and the runtime that has one
        expect(() => refuse('postgres()')).toThrow(
            new Error(
                [
                    'found: postgres() runs under node, and was called in a page',
                    'why: A page has no filesystem, no child process and no socket.',
                    'fix: specify it from a test collected by a node project (unit/api/job/cli/website/mobile); a rendered thing is a `.test.tsx` beside its component',
                    'read: docs/07-component.md#what-it-does-not-do',
                ].join('\n'),
            ),
        );
    });

    test('the page refuses what only node can do, where it was called — routes a rendered thing to the kind that renders', () => {
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

    test('the page refuses what only node can do, where it was called — a node-only class is present and throws when it is constructed', () => {
        // Given - a result class the page can name but never build
        const Stub: new () => unknown = nodeOnlyClass('CliResult');

        // Then - the name resolves, and `new` is what fails, saying which name
        expect(Stub).toBeTypeOf('function');
        expect(() => new Stub()).toThrow(
            new Error(
                [
                    'found: CliResult runs under node, and was called in a page',
                    'why: A page has no filesystem, no child process and no socket.',
                    'fix: specify it from a test collected by a node project (unit/api/job/cli/website/mobile); a rendered thing is a `.test.tsx` beside its component',
                    'read: docs/07-component.md#what-it-does-not-do',
                ].join('\n'),
            ),
        );
    });
});
