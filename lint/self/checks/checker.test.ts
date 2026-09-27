import { forgetTree } from '@jterrazz/typescript/rules';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CHECKER } from '../../consumer/checks/checker.js';
import { SELF_CHECKER, SELF_CHECKER_PASS_IDS } from './checker.js';

function specsTree(files: Record<string, string>): string {
    const scratch = mkdtempSync(join(tmpdir(), 'self-checks-'));
    const root = join(scratch, 'specs');
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    forgetTree();
    return root;
}

/** What `specimen-filed-by-capability` refuses. */
const MISFILED = {
    'api/api.specification.ts':
        "import { createApp } from '../_shared/_fixtures/specimen-api/app.js';\n",
    'api/users/list/listing.spec.ts': "import { api } from '../../api.specification.js';\n",
};

describe('checker', () => {
    test('checker — the self checker — the passes only this package runs — a self pass reports on the tree it is handed', () => {
        // Given - a spec of a specimen filed by its route
        const root = specsTree(MISFILED);

        // Then - the self checker names it, under its own pass
        expect(
            SELF_CHECKER.specs
                .flatMap((pass) => pass(root))
                .map(({ path, rule }) => `${path} ${rule}`),
        ).toStrictEqual(['api/users/list/listing.spec.ts specimen-filed-by-capability']);
    });

    test('checker — the self checker — the passes only this package runs — the published checker runs no self pass', () => {
        // Given - the same tree, walked by every pass `dist/checker.js` runs
        const root = specsTree(MISFILED);
        const selfPasses = new Set<string>(SELF_CHECKER_PASS_IDS);

        // Then - no finding belongs to a self pass: a consumer's run never meets this package's own discipline
        expect(
            CHECKER.tree.flatMap((pass) => pass(root)).filter(({ rule }) => selfPasses.has(rule)),
        ).toStrictEqual([]);
    });
});
