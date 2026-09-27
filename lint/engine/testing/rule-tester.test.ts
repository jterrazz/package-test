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
    test('refuses an invalid case whose errors are a count', () => {
        // Given - a case stating how many errors, and not where
        // Then - refused before any suite is declared, naming the case
        expect(() => {
            ruleTester().run('no-debugger', NO_DEBUGGER, unpositioned(1));
        }).toThrow('found: no-debugger: invalid case 0, whose errors are a count');
    });

    test('refuses an error that states no column', () => {
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
});
