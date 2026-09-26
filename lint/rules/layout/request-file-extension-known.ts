import type { Context } from '@oxlint/plugins';
import { dirname, extname, join } from 'node:path';

import { GROUND_REQUESTS } from '../../../src/kernel/files/ground.js';
import { lessons, rowOf } from '../../catalogue/lesson.js';
import type { AstNode } from '../../reading/ast.js';
import { isDirectory, listDirectory } from '../../reading/fs-cache.js';
import { identityOf } from '../../reading/linted-file.js';
import { isTestRole } from '../../reading/role.js';
import type { LintRule, Visitor } from '../rule.js';

/** Anchored on the visited test file: its sibling `requests/` is probed, and a file with no extension is reported there. */
export const requestFileExtensionKnown: LintRule = {
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
        docs: rowOf('request-file-extension-known'),
        messages: lessons('request-file-extension-known', {
            noExtension: {
                found: '`requests/{{entry}}` carries no extension',
                fix: 'name it by how it is sent — `requests/{{entry}}.http` for a whole request, `requests/{{entry}}.json` for a body the app parses, any other extension for a body sent verbatim',
            },
        }),
        type: 'problem',
    },
};
