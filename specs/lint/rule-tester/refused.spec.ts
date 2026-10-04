import { ruleTester } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

const NO_DEBUGGER = {
    create: (context: { report: (report: object) => void }) => ({
        DebuggerStatement: (node: object) => {
            context.report({ messageId: 'debugger', node });
        },
    }),
    meta: { messages: { debugger: 'no debugger' } },
};

const lessonFor = (found: string): string =>
    [
        `found: no-debugger: invalid case 0, ${found}`,
        'why: A rule proves where it reports, not only that it did: an error with no position passes for a report on any node.',
        'fix: state each error as an object carrying its `line` and `column`',
        'read: docs/guides/lint-specs.md#a-rule-alone-ruletester',
    ].join('\n');

describe('refused', () => {
    test('an invalid case whose errors are a count is refused before any suite is declared', () => {
        // Given - a case stating how many errors, and not where
        // Then - refused, naming the case
        expect(() => {
            ruleTester().run('no-debugger', NO_DEBUGGER, {
                // @ts-expect-error -- a count states no position: the type refuses it
                invalid: [{ code: 'debugger;', errors: 1 }],
                valid: [],
            });
        }).toThrow(lessonFor('whose errors are a count'));
    });

    test('an invalid case holding an error with no column is refused, naming that error', () => {
        // Given - an error placed on its line alone
        // Then - the error it names is the one with no position
        expect(() => {
            ruleTester().run('no-debugger', NO_DEBUGGER, {
                // @ts-expect-error -- an error with no column states no position: the type refuses it
                invalid: [{ code: 'debugger;', errors: [{ line: 1, messageId: 'debugger' }] }],
                valid: [],
            });
        }).toThrow(lessonFor('whose error 0 states no line and column'));
    });

    test('an invalid case stating no error is refused as stating none, not as a count', () => {
        // Given - a case whose errors are an empty list
        // Then - the refusal says what the author wrote
        expect(() => {
            ruleTester().run('no-debugger', NO_DEBUGGER, {
                invalid: [{ code: 'debugger;', errors: [] }],
                valid: [],
            });
        }).toThrow(lessonFor('which states no error'));
    });
});
