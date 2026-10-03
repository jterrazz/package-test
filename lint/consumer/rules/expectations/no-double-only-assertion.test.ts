import { ruleTester } from '@jterrazz/test';

import { noDoubleOnlyAssertion } from './no-double-only-assertion.js';

const MODULE_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('no-double-only-assertion', noDoubleOnlyAssertion, {
    invalid: [
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
