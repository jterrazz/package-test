import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import {
    GROUND_FIXTURES,
    RENAMED_GROUND_DIRS,
    SHARED_GROUND,
} from '../../../src/kernel/files/ground.js';
import { lessons, rowOf } from '../../catalogue/lesson.js';
import type { AstNode } from '../../reading/ast.js';
import { isDirectory, listDirectory } from '../../reading/fs-cache.js';
import { specsAnchorOf } from '../../reading/linted-file.js';
import type { LintRule, Visitor } from '../rule.js';

const TEST_FILE = /\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$/u;

const CONTRACTS_DIR = 'contracts';
const CONTRACTS_FACADE = /\.contracts\.[cm]?[jt]s$/u;

/** Outside a specs tree only a folder holding a `*.contracts.ts` facade: a product may name a folder `contracts/`. */
function isLeftoverContracts(dir: string, inSpecs: boolean): boolean {
    return (
        isDirectory(dir) &&
        (inSpecs || (listDirectory(dir) ?? []).some((name) => CONTRACTS_FACADE.test(name)))
    );
}

/** A tree keeping the 16 names still runs, so nothing else would say so. Anchored on the visited test file, as `request-file-extension-known`/C7/C11 are. */
export const groundUsesReservedName: LintRule = {
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
                // The 16 pool is ground for the whole tree, and 17 keeps it under `shared/`.
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
        docs: rowOf('ground-uses-reserved-name'),
        messages: lessons('ground-uses-reserved-name', {
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
