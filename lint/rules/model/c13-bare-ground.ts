import { dirname, join } from 'node:path';

import { RENAMED_GROUND_DIRS } from '../../../src/model/chain/ground.js';
import { specsAnchor } from '../../ast.js';
import { isDirectory } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';

/** The three suffixes that declare tests — `.test.ts(x)` and `.spec.ts`. */
const TEST_FILE = /\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$/u;

/**
 * CONVENTIONS C13 — ground folders carry bare, reserved names. A directory
 * named `_fixtures/`, `_expected/`, `_requests/` or `_seeds/` beside a test is
 * the 16.x name: since `@jterrazz/test` 17.0.0 the four are `fixtures/`,
 * `expected/`, `requests/` and `seeds/`, wherever a test stands on a file — a
 * spec under `specs/`, or a module test beside its module.
 *
 * The catch this rule exists for: a tree that keeps the old names still runs —
 * every path names its folder in full — so nothing fails, and the repository
 * speaks two dialects of the same law. This rule states the rename.
 *
 * Anchored on the visited test file, exactly as C2/C7/C11 are: the test's own
 * sibling directories are probed, plus the old pool at the nearest specs root
 * when the test sits under one.
 */
export const c13BareGround: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        const anchor = specsAnchor(file);
        if (!TEST_FILE.test(file)) {
            return {};
        }
        return {
            Program(node: AstNode) {
                const seen = new Set<string>();
                const probe = (parent: string, legacy: string): void => {
                    const path = join(parent, legacy);
                    if (seen.has(path) || !isDirectory(path)) {
                        return;
                    }
                    seen.add(path);
                    context.report({
                        data: { ground: RENAMED_GROUND_DIRS[legacy] ?? legacy, legacy },
                        messageId: 'underscored',
                        node,
                    });
                };
                for (const legacy of Object.keys(RENAMED_GROUND_DIRS)) {
                    probe(dirname(file), legacy);
                }
                // The pool is ground for the whole tree, and no spec sits beside it.
                if (anchor !== undefined) {
                    probe(anchor.directory, '_fixtures');
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c13-bare-ground'],
        messages: lessons('c13-bare-ground', {
            underscored: {
                found: '"{{legacy}}/" is a 16.x ground name',
                fix: 'rename it "{{ground}}/" with the paths that name it — `jterrazz-test-check --fix` does both (`make fix`)',
            },
        }),
        type: 'problem',
    },
};
