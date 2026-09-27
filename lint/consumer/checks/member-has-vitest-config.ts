import { treeEntries, treeKind } from '@jterrazz/typescript/rules';
import type { Manifest } from '@jterrazz/typescript/rules';
import { join } from 'node:path';

import { PRUNED_WITH_OUTPUTS } from '../../engine/project/module-tests.js';
import { isTestFileName } from '../../engine/project/role.js';
import type { Spotted } from './checker.js';

/** A directory carrying its own `package.json` is another package's tree, and its tests are its own to configure. */
function holdsTests(dir: string): boolean {
    const stack = [dir];
    let first = true;
    while (stack.length > 0) {
        const current = stack.pop();
        if (current === undefined) {
            break;
        }
        if (!first && treeKind(join(current, 'package.json')) === 'file') {
            continue;
        }
        first = false;
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!PRUNED_WITH_OUTPUTS.has(entry.name) && !entry.name.startsWith('.')) {
                    stack.push(join(current, entry.name));
                }
                continue;
            }
            if (isTestFileName(entry.name)) {
                return true;
            }
        }
    }
    return false;
}

/** `npm run test --workspaces`, `pnpm -r test` and `turbo run test` hand the work to the members: no evidence this package runs vitest. */
const DELEGATING_TEST =
    /--workspaces|(?:^|\s)-r(?:\s|$)|--recursive|turbo\s+run|nx\s+run-many|lerna\s+run/u;

export function checkMemberHasVitestConfig(
    manifest: Manifest,
    memberDir: string,
    label: string,
    subject: string,
): Spotted[] {
    // A delegating `test` script runs the members' tests, not this package's.
    const testScript = manifest.scripts?.test;
    const ownsTests =
        (typeof testScript === 'string' && !DELEGATING_TEST.test(testScript)) ||
        holdsTests(memberDir);
    if (!ownsTests) {
        return [];
    }
    return [
        {
            path: join(label, 'package.json'),
            line: 1,
            fix: `write ${join(label, 'vitest.config.ts')}: \`export default defineSpecConfig()\`, from \`@jterrazz/test/vitest\``,
            found: `${subject} has no vitest.config.ts — vitest's 5 s budget and an unexcluded \`_fixtures/\` are running its tests`,
            rule: 'member-has-vitest-config',
        },
    ];
}
