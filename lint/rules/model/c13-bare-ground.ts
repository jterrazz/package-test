import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import {
    GROUND_FIXTURES,
    RENAMED_GROUND_DIRS,
    SHARED_GROUND,
} from '../../../src/kernel/files/ground.js';
import { isDirectory, listDirectory } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { specsAnchorOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The three suffixes that declare tests — `.test.ts(x)` and `.spec.ts`. */
const TEST_FILE = /\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$/u;

/** The folder 16 declared its stubs in — `stubs/` since 17.0.0. */
const CONTRACTS_DIR = 'contracts';
/** A 16 stubs facade, `<name>.contracts.ts` — what marks a `contracts/` outside `specs/` as a stubs folder. */
const CONTRACTS_FACADE = /\.contracts\.[cm]?[jt]s$/u;

/**
 * Is `dir` a 16 stubs folder left behind: any `contracts/` in a specs tree, and
 * outside one only a folder holding a `*.contracts.ts` facade — a product may
 * name a folder of its own `contracts/`.
 */
function isLeftoverContracts(dir: string, inSpecs: boolean): boolean {
    return (
        isDirectory(dir) &&
        (inSpecs || (listDirectory(dir) ?? []).some((name) => CONTRACTS_FACADE.test(name)))
    );
}

/**
 * CONVENTIONS C13 — ground folders carry bare, reserved names. A directory
 * named `_fixtures/`, `_expected/`, `_requests/` or `_seeds/` beside a test is
 * the 16.x name: since `@jterrazz/test` 17.0.0 the four are `fixtures/`,
 * `expected/`, `requests/` and `seeds/`, wherever a test stands on a file — a
 * spec under `specs/`, or a module test beside its module.
 *
 * The stub folder moved the same way — a `contracts/` beside a test is the
 * 16.x name of `stubs/` — and is named in the same breath.
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
    createOnce(context: Context): Visitor {
        return {
            before: () => TEST_FILE.test(context.physicalFilename),
            Program(node: AstNode) {
                const file = context.physicalFilename;
                const anchor = specsAnchorOf(context);
                const seen = new Set<string>();
                const probe = (
                    parent: string,
                    legacy: string,
                    ground = RENAMED_GROUND_DIRS[legacy] ?? legacy,
                ): void => {
                    const path = join(parent, legacy);
                    if (seen.has(path) || !isDirectory(path)) {
                        return;
                    }
                    seen.add(path);
                    context.report({
                        data: { ground, legacy },
                        messageId: 'underscored',
                        node,
                    });
                };
                for (const legacy of Object.keys(RENAMED_GROUND_DIRS)) {
                    probe(dirname(file), legacy);
                }
                // The pool is ground for the whole tree, no spec sits beside it, and 17 keeps it under `shared/`.
                if (anchor !== undefined) {
                    probe(anchor.directory, '_fixtures', `${SHARED_GROUND}/${GROUND_FIXTURES}`);
                }
                if (isLeftoverContracts(join(dirname(file), CONTRACTS_DIR), anchor !== undefined)) {
                    context.report({ messageId: 'contracts', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c13-bare-ground'],
        messages: lessons('c13-bare-ground', {
            contracts: {
                found: '"contracts/" is the 16.x name of a stubs folder',
                fix: 'rename it "stubs/", its facades `*.stubs.ts` and the 16 names it imports — `jterrazz-test-check --fix` does all three (`make fix`)',
            },
            underscored: {
                found: '"{{legacy}}/" is a 16.x ground name',
                fix: 'rename it "{{ground}}/" with the paths that name it — `jterrazz-test-check --fix` does both (`make fix`)',
            },
        }),
        type: 'problem',
    },
};
