import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import { STUB_KINDS } from '../../../src/stubs/kinds.js';
import { listDirectory } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** Data files: served payloads and matched inputs, both owned by a stub. */
const DATA_SUFFIXES = ['.request.ts', '.response.json'];

/** The owning stub of a data file: its name up to the FIRST dot, `.ts`. */
function ownerOf(entry: string): string {
    return `${entry.slice(0, entry.indexOf('.'))}.ts`;
}

/**
 * CONVENTIONS C11 — data is owned by a stub. Inside a kind folder every
 * `*.response.json` (served payload) and `*.request.ts` (matched prompt/body)
 * pairs with the sibling `<stem>.ts` that serves it, where the stem is the name
 * up to the FIRST dot: `events.fr.response.json` belongs to `events.ts`. A data
 * file with no owner is dead weight no test can reach — reported on the feature's
 * test file, since oxlint never visits a `.json`.
 */
export const c11StubDataPairing: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const { inSpecs, role } = identityOf(context);
                return isTestRole(role) && inSpecs;
            },
            Program(node: AstNode) {
                const stubsDir = join(dirname(context.physicalFilename), 'stubs');
                for (const kind of STUB_KINDS) {
                    const entries = listDirectory(join(stubsDir, kind));
                    if (entries === null) {
                        continue;
                    }
                    const present = new Set(entries);
                    for (const entry of entries) {
                        if (!DATA_SUFFIXES.some((suffix) => entry.endsWith(suffix))) {
                            continue;
                        }
                        const owner = ownerOf(entry);
                        if (!present.has(owner)) {
                            context.report({
                                data: { entry, kind, owner },
                                messageId: 'orphan',
                                node,
                            });
                        }
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c11-stub-data-pairing'],
        messages: lessons('c11-stub-data-pairing', {
            orphan: {
                found: '`stubs/{{kind}}/{{entry}}` has no stub beside it',
                fix: 'write `stubs/{{kind}}/{{owner}}` — data pairs with the unit named by its stem, up to the first dot — or delete the orphan',
            },
        }),
        type: 'problem',
    },
};
