import type { TestProjectInlineConfiguration } from 'vitest/config';

import type { FacetProjectOptions } from './project-kit.js';
import { onProjectDefaults } from './project-kit.js';

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

// Every facet's helper is the FACET's, beside its constructor and its chain —
// One folder per facet. This module
// Is their index: the one import `@jterrazz/test/vitest` re-exports, plus the
// One project that is not a facet's.
export { api, type ApiProjectOptions } from '../facets/api/api.project.js';
export { cli, type CliProjectOptions } from '../facets/cli/cli.project.js';
export { component, type ComponentProjectOptions } from '../facets/component/component.project.js';
export {
    integration,
    type IntegrationProjectOptions,
} from '../facets/integration/integration.project.js';
export { job, type JobProjectOptions } from '../facets/job/job.project.js';
export { mobile, type MobileProjectOptions } from '../facets/mobile/mobile.project.js';
export { website, type WebsiteProjectOptions } from '../facets/website/website.project.js';
export { type FacetProjectOptions } from './project-kit.js';
export { type LiterateDoor } from '../facets/cli/cli.project.js';

/** `unit()` — module tests, beside the modules they cover (CONVENTIONS I2). */
export type UnitProjectOptions = {
    /**
     * `false` runs every file of a worker in ONE module graph instead of a
     * fresh one per file (`isolate: false`), so a worker imports each module
     * once. For a pure project only: a test that leaves state in a module — a
     * registry, a global matcher, a cache — reaches the next file of its
     * worker. Absent, vitest isolates each file.
     */
    isolate?: boolean;
    /**
     * The trees module tests live in, when they do not live in `src/`. Each
     * root becomes `<root>/**\/*.test.ts`; `include` states the globs outright.
     */
    roots?: string[];
} & FacetProjectOptions;

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
    return onProjectDefaults({
        test: {
            exclude: options.exclude ?? ['specs/**', '**/*.test.tsx'],
            include: options.include ?? fromRoots ?? ['**/*.test.ts'],
            ...(options.isolate === undefined ? {} : { isolate: options.isolate }),
            ...(options.serial === true ? { fileParallelism: false } : {}),
            name: 'unit',
            // Node projects run first; the two browser projects follow.
            sequence: { groupOrder: 0 },
            ...(options.timeout === undefined ? {} : { testTimeout: options.timeout }),
        },
    });
}
