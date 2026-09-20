import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import type { FacetProjectOptions } from './facet-project.js';
import { projectDefaults } from './preset.js';

/**
 * The project helpers — one per kind of test, each the canonical project that
 * kind runs in.
 *
 * A project is not a matter of taste: `--project component` has to mean the
 * same thing in every repository of the ecosystem, and what a browser project
 * needs (a provider pinned to the runner, a service worker, a Vite pipeline,
 * an artefact directory that is not the repository root) is the framework's to
 * know, not the consumer's to rediscover. So the consumer names the kind and
 * states only what is theirs.
 */

// Every facet's helper is the FACET's, beside its constructor, its chain and
// Its result — one folder per facet, the same four files in each. This module
// Is their index: the one import `@jterrazz/test/vitest` re-exports, plus the
// One project that is not a facet's.
export { api } from '../facets/api/api.project.js';
export { cli, type CliProjectOptions } from '../facets/cli/cli.project.js';
export { component, type ComponentProjectOptions } from '../facets/component/component.project.js';
export { integration } from '../facets/integration/integration.project.js';
export { jobs } from '../facets/jobs/jobs.project.js';
export { mobile } from '../facets/mobile/mobile.project.js';
export { website, type WebsiteProjectOptions } from '../facets/website/website.project.js';
export { type FacetProjectOptions } from './facet-project.js';

/** `unit()` — module tests, beside the modules they cover (CONVENTIONS I2). */
export type UnitProjectOptions = FacetProjectOptions & {
    /**
     * The trees module tests live in, when they do not live in `src/`. Each
     * root becomes `<root>/**\/*.test.ts`; `include` states the globs outright.
     */
    roots?: string[];
};

/**
 * A module test runs beside the module it covers: no DOM, no browser, no
 * pipeline. Its suffix is `.test.ts` and its place is OUTSIDE `specs/`, where
 * the assembled product is specified in `.spec.ts` — the two exclusions say
 * exactly that. `.test.tsx` is the third exclusion because a rendered thing is
 * a component test: a project's dependency scan reads every file its globs
 * match, and a `.tsx` collected here would be optimised for a page that never
 * opens.
 */
export function unit(options: UnitProjectOptions = {}): TestProjectInlineConfiguration {
    const fromRoots = options.roots?.map((root) => `${root.replace(/\/+$/u, '')}/**/*.test.ts`);
    return mergeConfig(projectDefaults(), {
        test: {
            exclude: options.exclude ?? ['specs/**', '**/*.test.tsx'],
            include: options.include ?? fromRoots ?? ['**/*.test.ts'],
            ...(options.serial === true ? { fileParallelism: false } : {}),
            name: 'unit',
            // Node projects run first; the two browser projects follow.
            sequence: { groupOrder: 0 },
            ...(options.timeout === undefined ? {} : { testTimeout: options.timeout }),
        },
    }) as TestProjectInlineConfiguration;
}
