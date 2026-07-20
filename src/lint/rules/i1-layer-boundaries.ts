import { dirname, resolve } from 'node:path';

import { importSourceVisitor, segments } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { LintRule, RuleContext, Visitor } from '../types.js';

/**
 * One folder = one external dependency (I1 — see docs/10-linting.md): the packages each
 * `src/integrations/<folder>/` may import.
 */
const INTEGRATION_DEPS: Record<string, string[]> = {
    anthropic: ['@anthropic-ai/sdk'],
    compose: ['yaml'],
    docker: [],
    hono: ['hono', '@hono/node-server'],
    msw: ['msw'],
    openai: ['openai'],
    playwright: ['playwright'],
    postgres: ['pg'],
    redis: ['redis'],
    sqlite: ['better-sqlite3'],
    testcontainers: ['testcontainers'],
};

/** External packages the vitest layer (ALL runner coupling) may import. */
const VITEST_DEPS = ['vitest', 'vitest-mock-extended', 'mockdate'];

/** The pure core helpers the tool-facing lint layer may reach (I1). */
const LINT_CORE_WHITELIST = new Set([
    'core/matching/match',
    'core/specification/shared/binding',
    'core/specification/shared/fixtures',
]);

const TEST_OR_FIXTURES = /\.(?:test|fixtures)\.[cm]?[jt]sx?$/;

function matchesPackage(source: string, packages: string[]): boolean {
    return packages.some((name) => source === name || source.startsWith(`${name}/`));
}

/** Path relative to the (last) `src` segment, `undefined` when outside src. */
function pathInsideSrc(path: string): string | undefined {
    const parts = segments(path);
    const srcIndex = parts.lastIndexOf('src');
    return srcIndex === -1 ? undefined : parts.slice(srcIndex + 1).join('/');
}

/** Strip a `.js`/`.ts`-style extension for whitelist comparison. */
function withoutExtension(path: string): string {
    return path.replace(/\.[cm]?[jt]sx?$/, '');
}

/**
 * CONVENTIONS I1 — the four layers under `src/` and their sanctioned edges:
 *
 * - `core/` — zero external imports; may reach `integrations/docker`,
 *   `integrations/hono`, `vitest/matchers`, and (from `builder.ts` only, the
 *   lazy MSW seam) `integrations/msw`.
 * - `integrations/<dep>/` — its own external dependency and `core/` only.
 * - `vitest/` — the runner coupling: `vitest`, `vitest-mock-extended`,
 *   `mockdate`, plus `core/` and `integrations/docker` (the matchers recognise
 *   the zero-dependency ContainerAccessor subject).
 * - `lint/` — zero runtime imports: no external packages, and from `core/`
 *   only the pure helpers (token list, case conversions, fixture markers).
 *
 * Module tests and fixtures files are exempt (their imports are governed by
 * F2/I4); `src/index.ts` is the composition root and lives above the layers.
 */
export const i1LayerBoundaries: LintRule = {
    create(context: RuleContext) {
        const file = context.physicalFilename;
        if (TEST_OR_FIXTURES.test(file)) {
            return {};
        }
        const inside = pathInsideSrc(file);
        const layer = inside?.split('/')[0];
        if (
            inside === undefined ||
            layer === undefined ||
            !['core', 'integrations', 'lint', 'vitest'].includes(layer)
        ) {
            return {};
        }
        const integrationFolder = layer === 'integrations' ? inside.split('/')[1] : undefined;

        const checkExternal = (source: string): null | string => {
            if (layer === 'core') {
                return 'coreExternal';
            }
            if (layer === 'lint') {
                return 'lintRuntime';
            }
            if (layer === 'vitest') {
                return matchesPackage(source, VITEST_DEPS) ? null : 'foreignDependency';
            }
            const own = INTEGRATION_DEPS[integrationFolder ?? ''] ?? [];
            return matchesPackage(source, own) ? null : 'foreignDependency';
        };

        const checkInternal = (target: string): null | string => {
            if (layer === 'core') {
                if (
                    target.startsWith('core/') ||
                    target.startsWith('integrations/docker/') ||
                    target.startsWith('integrations/hono/') ||
                    withoutExtension(target) === 'vitest/matchers'
                ) {
                    return null;
                }
                if (
                    target.startsWith('integrations/msw/') &&
                    inside === 'core/specification/shared/builder.ts'
                ) {
                    return null; // Sanctioned lazy seam: builder → integrations/msw.
                }
                if (
                    target.startsWith('integrations/playwright/') &&
                    inside === 'core/specification/website/start-website.ts'
                ) {
                    return null; // Sanctioned lazy seam: website runner → integrations/playwright.
                }
                return 'crossLayer';
            }
            if (layer === 'integrations') {
                return target.startsWith('core/') ||
                    target.startsWith(`integrations/${integrationFolder}/`)
                    ? null
                    : 'crossLayer';
            }
            if (layer === 'vitest') {
                // Integrations/docker is sanctioned (zero-dependency, structural
                // Coupling): the matchers recognise the ContainerAccessor subject.
                return target.startsWith('core/') ||
                    target.startsWith('vitest/') ||
                    target.startsWith('integrations/docker/')
                    ? null
                    : 'crossLayer';
            }
            // Lint layer: itself + the pure core helpers only.
            return target.startsWith('lint/') || LINT_CORE_WHITELIST.has(withoutExtension(target))
                ? null
                : 'lintRuntime';
        };

        const visitor: Visitor = {
            ...importSourceVisitor(({ node, source }) => {
                if (source.startsWith('node:')) {
                    return;
                }
                let messageId: null | string;
                if (source.startsWith('.')) {
                    const target = pathInsideSrc(resolve(dirname(file), source));
                    messageId = target === undefined ? 'crossLayer' : checkInternal(target);
                } else {
                    messageId = checkExternal(source);
                }
                if (messageId !== null) {
                    context.report({ data: { layer, source }, messageId, node });
                }
            }),
        };
        return visitor;
    },
    meta: {
        docs: RULE_DOCS['i1-layer-boundaries'],
        messages: {
            coreExternal:
                'core/ imports nothing external — "{{source}}" is not allowed (I1 — see docs/10-linting.md).',
            crossLayer:
                'Layer "{{layer}}" must not import "{{source}}" — outside the sanctioned layer edges (I1 — see docs/10-linting.md).',
            foreignDependency:
                '"{{source}}" is not this folder\'s own dependency — one integrations folder = one external dependency (I1 — see docs/10-linting.md).',
            lintRuntime:
                'The lint layer imports nothing from the framework runtime — "{{source}}" is outside its pure-helper whitelist (I1 — see docs/10-linting.md).',
        },
        type: 'problem',
    },
};
