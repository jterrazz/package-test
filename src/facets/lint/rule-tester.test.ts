import { describe, expect, test } from 'vitest';

import { ruleTester } from './rule-tester.js';
import type { PositionedCases } from './rule-tester.js';

const NO_DEBUGGER = {
    create: (context: { report: (report: object) => void }) => ({
        DebuggerStatement: (node: object) => {
            context.report({ messageId: 'debugger', node });
        },
    }),
    meta: { messages: { debugger: 'no debugger' } },
};

const unpositioned = (errors: unknown): PositionedCases =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the case a caller outside the types can still hand in, which the tester refuses at run time
    ({ invalid: [{ code: 'debugger;', errors }], valid: [] }) as unknown as PositionedCases;

describe('ruleTester', () => {
    test('ruleTester — an invalid case whose errors are a count — is refused before any suite is declared', () => {
        // Given - a case stating how many errors, and not where
        // Then - refused before any suite is declared, naming the case
        expect(() => {
            ruleTester().run('no-debugger', NO_DEBUGGER, unpositioned(1));
        }).toThrow('found: no-debugger: invalid case 0, whose errors are a count');
    });

    test('ruleTester — an invalid case holding an error with no column — is refused, naming that error', () => {
        // Given - an error placed on its line alone
        // Then - the error it names is the one with no position
        expect(() => {
            ruleTester().run(
                'no-debugger',
                NO_DEBUGGER,
                unpositioned([{ line: 1, messageId: 'debugger' }]),
            );
        }).toThrow('found: no-debugger: invalid case 0, whose error 0 states no line and column');
    });

    test('ruleTester — an invalid case stating no error — is refused as stating none, not as a count', () => {
        // Given - a case whose errors are an empty list
        // Then - the refusal says what the author wrote
        expect(() => {
            ruleTester().run('no-debugger', NO_DEBUGGER, unpositioned([]));
        }).toThrow('found: no-debugger: invalid case 0, which states no error');
    });
});
