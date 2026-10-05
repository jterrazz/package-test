import { ruleTester } from '@jterrazz/test';

import { noSleep } from './no-sleep.js';

const SPEC_FILE = '/repo/specs/cli/exec/exec.test.ts';

ruleTester().run('no-sleep', noSleep, {
    invalid: [
        {
            name: 'The bare timers/promises import, and a timer under a call that is no double.',
            code: 'import { setTimeout as sleep } from "timers/promises";\nmake(() => setTimeout(r, 5));',
            errors: [
                { column: 36, line: 1, messageId: 'timersImport' },
                { column: 11, line: 2, messageId: 'sleep' },
            ],
            filename: SPEC_FILE,
        },
        {
            name: 'The classic promisified sleep.',
            code: 'await new Promise((resolve) => setTimeout(resolve, 500));',
            errors: [{ column: 31, line: 1, messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
        {
            name: 'Member form.',
            code: 'globalThis.setTimeout(done, 100);',
            errors: [{ column: 0, line: 1, messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
        {
            name: 'Timer-promise import.',
            code: 'import { setTimeout as sleep } from "node:timers/promises";',
            errors: [{ column: 36, line: 1, messageId: 'timersImport' }],
            filename: SPEC_FILE,
        },
        {
            name: 'Interval polling is a sleep too.',
            code: 'setInterval(poll, 50);',
            errors: [{ column: 0, line: 1, messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
        {
            name: 'The Atomics.wait primitive blocks the thread.',
            code: 'Atomics.wait(view, 0, 0, 500);',
            errors: [{ column: 0, line: 1, messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
        {
            name: "A double's implementation ends where its call does: the sleep AFTER one is the test waiting, and still an error.",
            code: 'const clone = vi.fn(() => 1); await new Promise((resolve) => setTimeout(resolve, 5));',
            errors: [{ column: 61, line: 1, messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
        {
            name: "An object literal's implementation ends where the function does: the sleep in the test body after it is the test waiting.",
            code: 'const git: GitPort = { clone: async () => await Promise.resolve() }; await new Promise((resolve) => setTimeout(resolve, 5));',
            errors: [{ column: 100, line: 1, messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
        {
            name: "A property that is not a function is no implementation: the timer is the test's own, wherever the object it sits in came from.",
            code: 'const options = { handle: setTimeout(tick, 5) };',
            errors: [{ column: 26, line: 1, messageId: 'sleep' }],
            filename: SPEC_FILE,
        },
    ],
    valid: [
        {
            name: 'A timer inside each kind of double, and calls that only look like a sleep, wait for nothing.',
            code: [
                'const a = mockOf(() => setTimeout(r, 5));',
                'stub.mockImplementation(() => setTimeout(r, 5));',
                'stub.mockImplementationOnce(() => setInterval(r, 5));',
                'Atomics.load(view, 0);',
                'other.wait(1);',
                'wait(1);',
                'import { thing } from "node:timers";',
            ].join('\n'),
            filename: SPEC_FILE,
        },
        {
            name: 'Framework-level synchronisation.',
            code: 'await cli.exec("serve", { waitFor: /listening/ });',
            filename: SPEC_FILE,
        },
        {
            name: 'A timer inside a test double stages the world: the test is not the one waiting.',
            code: 'const clone = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 5)));',
            filename: SPEC_FILE,
        },
        {
            code: 'git.clone.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5)));',
            filename: SPEC_FILE,
        },
        {
            code: 'const port = mockOf<GitPort>({ clone: () => new Promise((resolve) => setTimeout(resolve, 5)) });',
            filename: SPEC_FILE,
        },
        {
            name: 'The plainest double there is: a typed object literal whose methods ARE the implementation. The object is the double.',
            code: 'const git: GitGateway = { cloneRepository: async () => await new Promise((resolve) => { setTimeout(resolve, 5); }) };',
            filename: SPEC_FILE,
        },
        {
            name: 'The method shorthand says the same thing.',
            code: 'const git = { async cloneRepository() { await new Promise((resolve) => { setTimeout(resolve, 5); }); } };',
            filename: SPEC_FILE,
        },
        {
            name: 'Outside specs/ the rule is inert.',
            code: 'setTimeout(tick, 100);',
            filename: '/repo/src/specification/specifications/_common/orchestrator.ts',
        },
    ],
});
