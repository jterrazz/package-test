import { join, relative } from 'node:path';

import { SPEC_EXTENSION } from '../../src/facets/cli/documents/spec-document.js';
import { treeEntries } from '../../src/kernel/files/git-tree.js';
import {
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
} from '../../src/kernel/files/ground.js';
import type { TokenViolation } from './checker.js';
import { checkSpecFile } from './document-follows-its-grammar.js';
import { checkSpecConventions } from './documents.js';
import { requestLineFindings, statusLineFindings } from './http-first-line-follows-its-grammar.js';
import { documentInGroundFindings } from './no-document-in-ground.js';
import { tokenInRequestFindings } from './no-token-in-request.js';
import { unknownTokenFindings } from './no-unknown-token.js';
import { volatileLiteralsInGround } from './no-volatile-literal.js';
import { checkSeedClockReads } from './seeds-state-absolute-time.js';
import { decodeText } from './tree.js';

const FIXTURE_DIRS = new Set<string>([GROUND_EXPECTED, GROUND_REQUESTS, GROUND_SEEDS]);

/** `fixtures/` trees are file state, not assertion fixtures: the token grammar has no meaning inside them. */
const SKIPPED_DIRS = new Set<string>(['.git', 'dist', GROUND_FIXTURES, 'node_modules']);

export function checkConventionFiles(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    const visit = (
        dir: string,
        inside: null | typeof GROUND_EXPECTED | typeof GROUND_REQUESTS | typeof GROUND_SEEDS,
    ): void => {
        let entries;
        try {
            entries = treeEntries(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            const rel = relative(rootDir, path);
            if (entry.isDirectory()) {
                if (SKIPPED_DIRS.has(entry.name)) {
                    continue;
                }
                const next = FIXTURE_DIRS.has(entry.name)
                    ? (entry.name as
                          | typeof GROUND_EXPECTED
                          | typeof GROUND_REQUESTS
                          | typeof GROUND_SEEDS)
                    : inside;
                visit(path, next);
                continue;
            }
            // A spec document is the scenario, not ground, so it is checked wherever the walk finds it; `no-document-in-ground` says where that is.
            if (entry.name.endsWith(SPEC_EXTENSION)) {
                violations.push(...documentInGroundFindings(rel, entry.name));
                const text = decodeText(path);
                if (text !== null) {
                    violations.push(
                        ...checkSpecFile(text, rel),
                        ...checkSpecConventions(text, rel, path),
                    );
                }
                continue;
            }
            if (inside === null) {
                continue;
            }
            const depth1 = dir.endsWith(`/${inside}`) || dir.endsWith(`\\${inside}`);

            if (inside === GROUND_SEEDS) {
                violations.push(...checkSeedClockReads(path, rel, entry.name));
                continue;
            }

            if (inside === GROUND_REQUESTS) {
                if (!entry.name.endsWith('.http')) {
                    continue; // `request-file-extension-known` (oxlint) owns the extension rule.
                }
                const text = decodeText(path);
                if (text === null) {
                    continue;
                }
                if (depth1) {
                    violations.push(...requestLineFindings(rel, entry.name, text));
                }
                violations.push(...tokenInRequestFindings(rel, text));
                continue;
            }

            const text = decodeText(path);
            if (text === null) {
                continue;
            }
            if (depth1 && entry.name.endsWith('.http')) {
                violations.push(...statusLineFindings(rel, entry.name, text));
            }
            // `no-volatile-literal` reaches ground as well as documents: the same volatile literal in the other half of the tree.
            violations.push(
                ...unknownTokenFindings(text, rel),
                ...volatileLiteralsInGround(rel, text),
            );
        }
    };
    visit(rootDir, null);
    return violations;
}
