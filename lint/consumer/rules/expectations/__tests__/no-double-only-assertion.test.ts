import { ruleTester } from '@jterrazz/test';

import { noDoubleOnlyAssertion } from '../no-double-only-assertion.js';

const MODULE_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('no-double-only-assertion', noDoubleOnlyAssertion, {
    invalid: [
        {
            name: 'A double awaited into its name, read by its last call, is the whole proof too.',
            code: `test('notifies', async () => {
                const spy = await vi.spyOn(mailer, 'send');
                await notify();
                expect(spy).toHaveBeenLastCalledWith('hello');
            });
            test('logs', () => {
                const log = vi.fn();
                expect(log).toHaveBeenCalled();
            });`,
            errors: [
                { column: 0, line: 1, messageId: 'doubleOnly' },
                { column: 12, line: 6, messageId: 'doubleOnly' },
            ],
            filename: MODULE_FILE,
        },
        {
            name: 'The whole proof is the call log of a port the test built.',
            code: `test('notifies', () => {
                const mailer = mockOf<Mailer>();
                notify(mailer);
                expect(mailer.send).toHaveBeenCalledOnce();
            });`,
            errors: [{ column: 0, line: 1, messageId: 'doubleOnly' }],
            filename: MODULE_FILE,
        },
        {
            name: 'Two assertions, both on doubles.',
            code: `test('notifies', () => {
                const send = vi.fn();
                notify({ send });
                expect(send).toHaveBeenCalledOnce();
                expect(send).toHaveBeenCalledWith('hello');
            });`,
            errors: [{ column: 0, line: 1, messageId: 'doubleOnly' }],
            filename: MODULE_FILE,
        },
    ],
    valid: [
        {
            name: 'What no double factory built, a double read by value, a test with no assertion, and a call that is no test, prove more.',
            code: [
                "test('a', () => { const port = createPort(); expect(port.send).toHaveBeenCalled(); });",
                "test('b', () => { let later; expect(later).toHaveBeenCalled(); });",
                "test('b2', () => { const factory = mockOf; expect(factory).toHaveBeenCalled(); });",
                "test('c', () => { const send = vi.fn(); expect(send).toBe(other); });",
                "test('d', () => { const send = vi.fn(); send(); });",
                "test('e', () => { expect(other.send).toHaveBeenCalled(); });",
                'run(() => { const send = vi.fn(); expect(send).toHaveBeenCalled(); });',
                "test('f');",
            ].join('\n'),
            filename: MODULE_FILE,
        },
        {
            name: 'A double beside something the subject produced.',
            code: `test('notifies', () => {
                const mailer = mockOf<Mailer>();
                const result = notify(mailer);
                expect(result).toBe('sent');
                expect(mailer.send).toHaveBeenCalledOnce();
            });`,
            filename: MODULE_FILE,
        },
        {
            name: 'No double at all.',
            code: `test('notifies', () => {
                expect(notify()).toBe('sent');
            });`,
            filename: MODULE_FILE,
        },
        {
            name: 'A component reads its callback prop this way by design.',
            code: `test('closes', () => {
                const onClose = vi.fn();
                render(<Host onClose={onClose} />);
                expect(onClose).toHaveBeenCalledOnce();
            });`,
            filename: '/repo/src/web/host.test.tsx',
        },
    ],
});
