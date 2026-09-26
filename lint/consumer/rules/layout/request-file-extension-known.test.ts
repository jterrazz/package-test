import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { checkoutUnder } from '../../../engine/testing/package-tree.fixtures.js';
import { requestFileExtensionKnown } from './request-file-extension-known.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPECS_LINT = resolve(import.meta.dirname, '../../../../specs/lint');

const TWO_BARE = checkoutUnder('work', ['specs/app/widget/requests']);
writeFileSync(join(TWO_BARE, 'specs/app/widget/requests/order'), '{}\n');
writeFileSync(join(TWO_BARE, 'specs/app/widget/requests/notes'), 'notes\n');

const SENT = checkoutUnder('work', ['specs/app/widget/requests/orders']);
writeFileSync(join(SENT, 'specs/app/widget/requests/create.http'), 'POST /orders\n');
writeFileSync(join(SENT, 'specs/app/widget/requests/order.json'), '{}\n');
writeFileSync(join(SENT, 'specs/app/widget/requests/note.txt'), 'note\n');
mkdirSync(join(SENT, 'specs/app/widget/requests/orders'), { recursive: true });
writeFileSync(join(SENT, 'specs/app/widget/requests/orders/big.json'), '{}\n');

ruleTester.run('request-file-extension-known', requestFileExtensionKnown as unknown as OxlintRule, {
    invalid: [
        // Every bare file is named: two of them, two reports.
        {
            code: 'test("x", () => {});',
            errors: [{ messageId: 'noExtension' }, { messageId: 'noExtension' }],
            filename: `${TWO_BARE}/specs/app/widget/widget.test.ts`,
        },
        // The violation fixture keeps a body with no extension next to the .http.
        {
            code: 'test("x", () => {});',
            errors: 1,
            filename: `${SPECS_LINT}/request-file-extension-known/fixtures/violation/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        // A whole request and a body, side by side, in the compliant twin.
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/request-file-extension-known/fixtures/compliant/specs/app/widget/widget.test.ts`,
        },
        // A `.http`, a `.json` and a `.txt` body, and a folder: everything a spec sends.
        {
            code: 'test("x", () => {});',
            filename: `${SENT}/specs/app/widget/widget.test.ts`,
        },
        // No requests/ directory at this level (the feature has no requests/ sibling).
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/request-file-extension-known/fixtures/compliant/specs/app/app.test.ts`,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'test("x", () => {});',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
