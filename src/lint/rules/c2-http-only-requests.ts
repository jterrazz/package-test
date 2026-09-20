import { dirname, join } from 'node:path';

import { GROUND_REQUESTS } from '../../core/chain/ground.js';
import { listDirectory } from '../fs-cache.js';
import { RULE_DOCS } from '../manifest.js';
import { isTestRole, roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/**
 * CONVENTIONS C2 — `_requests/` contains only `.http` files (a request file is
 * a COMPLETE request: method, path, headers, body). Anchored on the feature's
 * visited test file: when `<feature>/<feature>.test.ts` is linted, its sibling
 * `_requests/` directory is probed (cached readdir) and any non-`.http` entry
 * is reported on the test file.
 */
export const c2HttpOnlyRequests: LintRule = {
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
                    if (!entry.endsWith('.http')) {
                        context.report({ data: { entry }, messageId: 'notHttp', node });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c2-http-only-requests'],
        messages: {
            notHttp:
                '_requests/{{entry}} is not a .http file — _requests/ contains only complete .http request files.',
        },
        type: 'problem',
    },
};
