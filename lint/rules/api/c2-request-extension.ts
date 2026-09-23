import { dirname, extname, join } from 'node:path';

import { GROUND_REQUESTS } from '../../../src/model/chain/ground.js';
import { isDirectory, listDirectory } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';
import { isTestRole, roleOf } from '../../role.js';

/**
 * CONVENTIONS C2 — `requests/` holds what a spec SENDS: a whole request as a
 * `.http`, or a body a verb sends (`.json`, `.txt`, …), and every one of them
 * carries its extension, which is how it is sent — a `.http` whole, a `.json`
 * parsed, anything else verbatim. Anchored on the feature's visited test
 * file: its sibling `requests/` is probed (cached) and a file with no
 * extension is reported on the test file. A folder is not a request and is
 * not judged here.
 */
export const c2RequestExtension: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        const { inSpecs, role } = roleOf(file);
        if (!isTestRole(role) || !inSpecs) {
            return {};
        }
        return {
            Program(node: AstNode) {
                const requestsDir = join(dirname(file), GROUND_REQUESTS);
                for (const entry of listDirectory(requestsDir) ?? []) {
                    if (extname(entry) === '' && !isDirectory(join(requestsDir, entry))) {
                        context.report({ data: { entry }, messageId: 'noExtension', node });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c2-request-extension'],
        messages: lessons('c2-request-extension', {
            noExtension: {
                found: '`requests/{{entry}}` carries no extension',
                fix: 'name it by how it is sent — `requests/{{entry}}.http` for a whole request, `requests/{{entry}}.json` for a body the app parses, any other extension for a body sent verbatim',
            },
        }),
        type: 'problem',
    },
};
