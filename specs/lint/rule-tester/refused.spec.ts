import { ruleTester } from '@jterrazz/test';
import type { PositionedCases } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

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

const lessonFor = (found: string): string =>
    [
        `found: no-debugger: invalid case 0, ${found}`,
        'why: A rule proves where it reports, not only that it did: an error with no position passes for a report on any node.',
        'fix: state each error as an object carrying its `line` and `column`',
        'read: docs/16-lint.md#a-rule-alone-ruletester',
    ].join('\n');

describe('refused', () => {
    test('an invalid case whose errors are a count is refused before any suite is declared', () => {
        // Given - a case stating how many errors, and not where
        // Then - refused, naming the case
        expect(() => {
            ruleTester().run('no-debugger', NO_DEBUGGER, unpositioned(1));
        }).toThrow(lessonFor('whose errors are a count'));
    });

    test('an invalid case holding an error with no column is refused, naming that error', () => {
        // Given - an error placed on its line alone
        // Then - the error it names is the one with no position
        expect(() => {
            ruleTester().run(
                'no-debugger',
                NO_DEBUGGER,
                unpositioned([{ line: 1, messageId: 'debugger' }]),
            );
        }).toThrow(lessonFor('whose error 0 states no line and column'));
    });

    test('an invalid case stating no error is refused as stating none, not as a count', () => {
        // Given - a case whose errors are an empty list
        // Then - the refusal says what the author wrote
        expect(() => {
            ruleTester().run('no-debugger', NO_DEBUGGER, unpositioned([]));
        }).toThrow(lessonFor('which states no error'));
    });
});
