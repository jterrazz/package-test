import { ruleTester } from '@jterrazz/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { checkoutUnder } from '../../../../kit/testing/package-tree.fixtures.js';
import { requestFileExtensionKnown } from '../request-file-extension-known.js';

const SPECS_LINT = resolve(import.meta.dirname, '../../../../../specs/lint');

const TWO_BARE = checkoutUnder('work', ['specs/app/widget/__requests__']);
writeFileSync(join(TWO_BARE, 'specs/app/widget/__requests__/order'), '{}\n');
writeFileSync(join(TWO_BARE, 'specs/app/widget/__requests__/notes'), 'notes\n');

const SENT = checkoutUnder('work', ['specs/app/widget/__requests__/orders']);
writeFileSync(join(SENT, 'specs/app/widget/__requests__/create.http'), 'POST /orders\n');
writeFileSync(join(SENT, 'specs/app/widget/__requests__/order.json'), '{}\n');
writeFileSync(join(SENT, 'specs/app/widget/__requests__/note.txt'), 'note\n');
mkdirSync(join(SENT, 'specs/app/widget/__requests__/orders'), { recursive: true });
writeFileSync(join(SENT, 'specs/app/widget/__requests__/orders/big.json'), '{}\n');

ruleTester().run('request-file-extension-known', requestFileExtensionKnown, {
    invalid: [
        {
            name: 'Every bare file is named: two of them, two reports.',
            code: 'test("x", () => {});',
            errors: [
                { column: 0, line: 1, messageId: 'noExtension' },
                { column: 0, line: 1, messageId: 'noExtension' },
            ],
            filename: `${TWO_BARE}/specs/app/widget/widget.test.ts`,
        },
        {
            name: 'The violation fixture keeps a body with no extension next to the .http.',
            code: 'test("x", () => {});',
            errors: [{ column: 0, line: 1, messageId: 'noExtension' }],
            filename: `${SPECS_LINT}/request-file-extension-known/__fixtures__/violation/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        {
            name: 'A test outside specs/, and a module of specs/ that is no test, read no request.',
            code: 'test("x", () => {});',
            filename: `${TWO_BARE}/src/widget.test.ts`,
        },
        { code: 'export {};', filename: `${TWO_BARE}/specs/app/widget/helper.ts` },
        {
            name: 'A whole request and a body, side by side, in the compliant twin.',
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/request-file-extension-known/__fixtures__/compliant/specs/app/widget/widget.test.ts`,
        },
        {
            name: 'A `.http`, a `.json` and a `.txt` body, and a folder: everything a spec sends.',
            code: 'test("x", () => {});',
            filename: `${SENT}/specs/app/widget/widget.test.ts`,
        },
        {
            name: 'No __requests__/ directory at this level (the feature has no __requests__/ sibling).',
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/request-file-extension-known/__fixtures__/compliant/specs/app/app.test.ts`,
        },
        {
            name: 'Outside specs/ the rule is inert.',
            code: 'test("x", () => {});',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
