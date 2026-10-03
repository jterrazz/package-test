import { ruleTester } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { checkoutUnder } from '../../../kit/testing/package-tree.fixtures.js';
import { requestFileExtensionKnown } from './request-file-extension-known.js';

const SPECS_LINT = resolve(import.meta.dirname, '../../../../specs/lint');

const TWO_BARE = checkoutUnder('work', ['specs/app/widget/_requests']);
writeFileSync(join(TWO_BARE, 'specs/app/widget/_requests/order'), '{}\n');
writeFileSync(join(TWO_BARE, 'specs/app/widget/_requests/notes'), 'notes\n');

const SENT = checkoutUnder('work', ['specs/app/widget/_requests/orders']);
writeFileSync(join(SENT, 'specs/app/widget/_requests/create.http'), 'POST /orders\n');
writeFileSync(join(SENT, 'specs/app/widget/_requests/order.json'), '{}\n');
writeFileSync(join(SENT, 'specs/app/widget/_requests/note.txt'), 'note\n');
mkdirSync(join(SENT, 'specs/app/widget/_requests/orders'), { recursive: true });
writeFileSync(join(SENT, 'specs/app/widget/_requests/orders/big.json'), '{}\n');

ruleTester().run('request-file-extension-known', requestFileExtensionKnown, {
    invalid: [
        // Every bare file is named: two of them, two reports.
        {
            code: 'test("x", () => {});',
            errors: [
                { column: 0, line: 1, messageId: 'noExtension' },
                { column: 0, line: 1, messageId: 'noExtension' },
            ],
            filename: `${TWO_BARE}/specs/app/widget/widget.test.ts`,
        },
        // The violation fixture keeps a body with no extension next to the .http.
        {
            code: 'test("x", () => {});',
            errors: [{ column: 0, line: 1, messageId: 'noExtension' }],
            filename: `${SPECS_LINT}/request-file-extension-known/_fixtures/violation/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        // A whole request and a body, side by side, in the compliant twin.
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/request-file-extension-known/_fixtures/compliant/specs/app/widget/widget.test.ts`,
        },
        // A `.http`, a `.json` and a `.txt` body, and a folder: everything a spec sends.
        {
            code: 'test("x", () => {});',
            filename: `${SENT}/specs/app/widget/widget.test.ts`,
        },
        // No _requests/ directory at this level (the feature has no _requests/ sibling).
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/request-file-extension-known/_fixtures/compliant/specs/app/app.test.ts`,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
