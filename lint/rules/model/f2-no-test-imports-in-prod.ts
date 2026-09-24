import type { Context } from '@oxlint/plugins';
import { dirname, relative } from 'node:path';

import { lessons } from '../../lesson.js';
import { isProductionFile } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { mergeVisitors, pathReferenceVisitor } from '../../path-references.js';
import {
    allowedTestPackagesAt,
    materialNamed,
    moduleReferenceVisitor,
    reachOf,
} from '../../production.js';
import type { LintRule, Visitor } from '../../rule-shape.js';

/**
 * CONVENTIONS F2 — production never reaches test material. In a production
 * module (`production.ts` defines it, for every guard), a reference in any
 * form — import, `import type`, re-export, `import()`, `require()` — that
 * reaches a test package, a test/spec/specification/fixtures module, ground,
 * the `specs/` tree or a contract, directly, through a `paths` alias or a
 * `#…` import, or through a module that is not production, is an error; so is
 * a path the module builds from where it sits (`new URL(…, import.meta.url)`,
 * `join(import.meta.dirname, …)`) or reads (`readFileSync('./…')`) into test
 * material.
 *
 * Sanctioned exceptions: `@jterrazz/test/oxlint`, the tool-facing, zero-runtime
 * lint entry (F1) — a shared oxlint preset legitimately imports it; and a test
 * package the unit's `jterrazz.config.ts` allows under `test.production.allow`,
 * with the reason its product runs it.
 *
 * This repository's runner coupling (I1) turns the rule off by path in its
 * own oxlint config.
 */
export const f2NoTestImportsInProd: LintRule = {
    createOnce(context: Context): Visitor {
        let allowed: ReadonlySet<string> = new Set();
        const shown = (path: string): string =>
            relative(dirname(context.physicalFilename), path) || path;
        const references = moduleReferenceVisitor(({ node, source }) => {
            const reach = reachOf(context.physicalFilename, source, allowed);
            if (reach === undefined) {
                return;
            }
            const what = reach.kind === 'a test package' ? reach.what : shown(reach.what);
            const data = { kind: reach.kind, source, what };
            if (reach.through.length > 0) {
                const through = reach.through.map((module) => shown(module)).join(' → ');
                context.report({ data: { ...data, through }, messageId: 'reachThrough', node });
            } else {
                context.report({ data, messageId: 'reach', node });
            }
        });
        const paths = pathReferenceVisitor(
            () => context.physicalFilename,
            ({ node, path }) => {
                const kind = materialNamed(path);
                if (kind !== undefined) {
                    context.report({
                        data: { kind, path: shown(path) },
                        messageId: 'pathRead',
                        node,
                    });
                }
            },
        );
        return {
            ...mergeVisitors(references, paths),
            before() {
                if (!isProductionFile(context)) {
                    return false;
                }
                allowed = allowedTestPackagesAt(context.physicalFilename);
                return true;
            },
        };
    },
    meta: {
        docs: RULE_DOCS['f2-no-test-imports-in-prod'],
        messages: lessons('f2-no-test-imports-in-prod', {
            pathRead: {
                found: 'production code names the path "{{path}}", {{kind}}',
                fix: 'move what production reads out of the test material, or have the caller hand it in',
            },
            reach: {
                found: 'production code references "{{source}}", {{kind}} ({{what}})',
                fix: 'move the reference into a test — specs, `*.test.ts`, `*.fixtures.ts` or `*.specification.ts` — or move what production needs out of the test material',
            },
            reachThrough: {
                found: 'production code references "{{source}}", which reaches {{kind}} ({{what}}) through {{through}}',
                fix: 'cut the edge that leaves production for test material: move what production needs out of it, or the reference into a test',
            },
        }),
        type: 'problem',
    },
};
