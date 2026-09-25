import type { Context } from '@oxlint/plugins';
import { dirname, extname, join } from 'node:path';

import { GROUND_REQUESTS } from '../../../src/kernel/files/ground.js';
import { isDirectory, listDirectory } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** Anchored on the visited test file: its sibling `requests/` is probed, and a file with no extension is reported there. */
export const c2RequestExtension: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const { inSpecs, role } = identityOf(context);
                return isTestRole(role) && inSpecs;
            },
            Program(node: AstNode) {
                const requestsDir = join(dirname(context.physicalFilename), GROUND_REQUESTS);
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
