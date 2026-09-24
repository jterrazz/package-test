import { dirname, join } from 'node:path';

import { listDirectory } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';
import { isTestRole } from '../../role.js';

/** The provider folders that may carry data files. */
const PROVIDERS = ['anthropic', 'http', 'openai'];

/** Data files: served payloads and matched inputs, both owned by a contract. */
const DATA_SUFFIXES = ['.request.ts', '.response.json'];

/** The owning contract of a data file: its name up to the FIRST dot, `.ts`. */
function ownerOf(entry: string): string {
    return `${entry.slice(0, entry.indexOf('.'))}.ts`;
}

/**
 * CONVENTIONS C11 — data is owned by a contract. Inside a provider folder every
 * `*.response.json` (served payload) and `*.request.ts` (matched prompt/body)
 * pairs with the sibling `<stem>.ts` that serves it, where the stem is the name
 * up to the FIRST dot: `events.fr.response.json` belongs to `events.ts`. A data
 * file with no owner is dead weight no test can reach — reported on the feature's
 * test file, since oxlint never visits a `.json`.
 */
export const c11ContractDataPairing: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        const { inSpecs, role } = identityOf(context);
        if (!isTestRole(role) || !inSpecs) {
            return {};
        }
        return {
            Program(node: AstNode) {
                const contractsDir = join(dirname(file), 'contracts');
                for (const provider of PROVIDERS) {
                    const entries = listDirectory(join(contractsDir, provider));
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
                                data: { entry, owner, provider },
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
        docs: RULE_DOCS['c11-contract-data-pairing'],
        messages: lessons('c11-contract-data-pairing', {
            orphan: {
                found: '`contracts/{{provider}}/{{entry}}` has no contract beside it',
                fix: 'write `contracts/{{provider}}/{{owner}}` — data pairs with the unit named by its stem, up to the first dot — or delete the orphan',
            },
        }),
        type: 'problem',
    },
};
