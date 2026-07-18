import { dirname, join } from 'node:path';

import { segments } from '../ast.js';
import { listDirectory } from '../fs-cache.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/**
 * CONVENTIONS C2 — `requests/` contains only `.http` files (a request file is
 * a COMPLETE request: method, path, headers, body). Anchored on the feature's
 * visited test file: when `<feature>/<feature>.test.ts` is linted, its sibling
 * `requests/` directory is probed (cached readdir) and any non-`.http` entry
 * is reported on the test file.
 */
export const c2HttpOnlyRequests: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        if (!TEST_FILE.test(file) || !segments(file).includes('specs')) {
            return {};
        }
        return {
            Program(node: AstNode) {
                const requestsDir = join(dirname(file), 'requests');
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
                'requests/{{entry}} is not a .http file — requests/ contains only complete .http request files (CONVENTIONS C2).',
        },
        type: 'problem',
    },
};
