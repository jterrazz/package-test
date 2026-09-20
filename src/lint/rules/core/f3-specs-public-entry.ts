import { importSourceVisitor, specsAnchor } from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { declaredSubpaths } from '../../package-exports.js';
import type { LintRule, RuleContext, Visitor } from '../../types.js';

const PACKAGE = '@jterrazz/test';

/**
 * The framework's own top-level `src/` layers. Deep-importing any of these from
 * a spec couples the spec to internals the public entry exists to hide. These
 * segment names are only meaningful inside the framework repo itself — a
 * consumer app that happens to have `src/app.ts` never reaches one, so its own
 * spec-to-app imports stay allowed (that IS the documented pattern:
 * `server: () => createApp()` importing `../../src/app.js`).
 */
const FRAMEWORK_LAYERS = new Set(['core', 'facets', 'lint', 'runner', 'seams']);

/**
 * CONVENTIONS F3 — from `specs/`, deep-importing the FRAMEWORK's internals is
 * forbidden: a relative path resolving inside the framework repo's
 * `src/{core,facets,seams,runner,lint}/`, or a `@jterrazz/test/<subpath>`
 * the package does not publish. A consumer's imports of its OWN app source are
 * always allowed — that is the pattern.
 *
 * The exempt subpaths are not listed here: they are read from the package's own
 * `exports` map, the same source F1 uses. A published subpath IS the public
 * surface — reaching `@jterrazz/test/vitest` from a specs-tree `vitest.config.ts`
 * is the prescribed gesture, not a leak — so what a spec must not reach is what
 * the manifest never published. The root entry (`.`) is not a subpath and never
 * concerned this branch: `@jterrazz/test` is the public entry F3 points at.
 *
 * Distinct from F1 (which judges the same specifiers from any file): F3 is the
 * specs-specific guard that also reaches relative framework-internal paths.
 * There is no folder exception: a probe that cannot reach its subject through
 * the public entry is a module test beside its module, not a spec.
 */
export const f3SpecsPublicEntry: LintRule = {
    create(context: RuleContext) {
        const anchor = specsAnchor(context.filename);
        if (anchor === undefined) {
            return {};
        }
        const published = new Set(declaredSubpaths());
        const exempt = published.size === 0 ? 'none' : [...published].join(', ');
        const visitor: Visitor = {
            ...importSourceVisitor(({ node, source }) => {
                // Framework subpath imports (overlaps F1, kept specs-specific).
                if (source.startsWith(`${PACKAGE}/`)) {
                    if (published.has(source)) {
                        return; // A subpath the package's `exports` map publishes.
                    }
                    context.report({
                        data: { published: exempt, source },
                        messageId: 'deepImport',
                        node,
                    });
                    return;
                }
                // Relative imports that resolve inside a `src/` tree.
                const marker = source.indexOf('/src/');
                if (marker === -1 && !source.startsWith('src/')) {
                    return;
                }
                const internal = marker === -1 ? source.slice(4) : source.slice(marker + 5);
                const layer = internal.split('/')[0] ?? '';
                if (!FRAMEWORK_LAYERS.has(layer)) {
                    return; // Consumer's own app source (e.g. src/app.js) — the pattern.
                }
                context.report({
                    data: { published: exempt, source },
                    messageId: 'deepImport',
                    node,
                });
            }),
        };
        return visitor;
    },
    meta: {
        docs: RULE_DOCS['f3-specs-public-entry'],
        messages: {
            deepImport:
                'specs/ must not deep-import framework internals — reach the framework via its public entry (@jterrazz/test, or src/index.js in this repo), not "{{source}}". Exempt: the published subpaths {{published}}. A probe whose subject is not on the public entry is a module test beside its module.',
        },
        type: 'problem',
    },
};
