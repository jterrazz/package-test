import { isGroundName } from '../../../src/model/chain/ground.js';
import { importSourceVisitor, isUnderSpecs } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { LintRule, RuleContext, Visitor } from '../../oxlint-api.js';

const TEST_FILE = /\.(?:(?:test|fixtures|specification)\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$/u;
const CONFIG_FILE = /(?:^|[/\\])[\w.-]*\.config\.[cm]?[jt]s$/u;
const TEST_IMPORT = /\.(?:test|fixtures)(?:\.[cm]?[jt]sx?)?$/u;
const TOOL_SUBPATH = '@jterrazz/test/oxlint';

/** A relative import that passes through one of the four ground folders. */
function reachesGround(source: string): boolean {
    return source.startsWith('.') && source.split('/').some((segment) => isGroundName(segment));
}

/**
 * CONVENTIONS F2 — production code never imports a test artefact. In a
 * non-test file (not `*.test.ts` / `*.fixtures.ts` / `*.specification.ts`,
 * not under `specs/`, not a tool config), importing `vitest`,
 * `@jterrazz/test`, a `*.test.*` module, a `*.fixtures.*` module, or anything
 * under a ground folder (`fixtures/`, `expected/`, `requests/`, `seeds/` — the
 * names mean ground wherever a test stands on a file) is flagged.
 *
 * Sanctioned exception: `@jterrazz/test/oxlint`, the tool-facing, zero-runtime
 * lint entry (F1) — a shared oxlint preset legitimately imports it from prod
 * code.
 *
 * This repo's `src/vitest/` layer (the framework's own runner coupling, I1)
 * disables the rule via a config override.
 */
export const f2NoTestImportsInProd: LintRule = {
    create(context: RuleContext) {
        const file = context.filename;
        if (TEST_FILE.test(file) || CONFIG_FILE.test(file) || isUnderSpecs(file)) {
            return {};
        }
        const visitor: Visitor = {
            ...importSourceVisitor(({ node, source }) => {
                if (source === TOOL_SUBPATH) {
                    return;
                }
                if (source === 'vitest' || source.startsWith('vitest/')) {
                    context.report({ data: { source }, messageId: 'testImport', node });
                } else if (source === '@jterrazz/test' || source.startsWith('@jterrazz/test/')) {
                    context.report({ data: { source }, messageId: 'testImport', node });
                } else if (TEST_IMPORT.test(source)) {
                    context.report({ data: { source }, messageId: 'testImport', node });
                } else if (reachesGround(source)) {
                    context.report({ data: { source }, messageId: 'groundImport', node });
                }
            }),
        };
        return visitor;
    },
    meta: {
        docs: RULE_DOCS['f2-no-test-imports-in-prod'],
        messages: lessons('f2-no-test-imports-in-prod', {
            groundImport: {
                found: 'production code imports "{{source}}", under a ground folder',
                fix: 'move what production needs out of the ground folder; `fixtures/`, `expected/`, `requests/` and `seeds/` are what a test stands on',
            },
            testImport: {
                found: 'production code imports the test artefact "{{source}}"',
                fix: 'move the import into a test — specs, `*.test.ts`, `*.fixtures.ts` or `*.specification.ts` — or move what production needs out of it',
            },
        }),
        type: 'problem',
    },
};
