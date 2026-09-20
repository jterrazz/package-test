import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { projectDefaults } from './preset.js';

/**
 * The node facets' canonical projects.
 *
 * Each one collects the facet's own tree — `specs/<facet>/**\/*.spec.ts`, the
 * suffix that says "the assembled product" — carries the preset's budgets and
 * artefact directory, and runs in group 0 — the browser facets follow, so two
 * Chromiums never share a slot on a two-vCPU runner. `{ include, exclude,
 * timeout, serial }` is what a repository states when its tree, its budget or
 * its parallelism differs;
 * everything else is the framework's.
 */

/** What every helper accepts on top of its canonical project. */
export type FacetProjectOptions = {
    /**
     * Globs this project stays out of. On a facet helper they ADD to the
     * preset's (`_fixtures/` and vitest's own), because vite concatenates. On
     * `unit()` and `component()`, whose canonical `exclude` exists only to
     * guard their canonical `include`, stating one replaces it — so state
     * both or neither there.
     */
    exclude?: string[];
    /** Replace the canonical `include` globs. */
    include?: string[];
    /**
     * Run this project's files ONE AT A TIME (`fileParallelism: false`) — for
     * the facets whose files share something a second worker would collide
     * with: one served app, one database file, one browser profile.
     */
    serial?: boolean;
    /** Raise (or lower) the 30s budget for this project alone. */
    timeout?: number;
};

/** The globs a node facet collects, and the ones a caller stated instead. */
export function facetProject(
    facet: string,
    options: FacetProjectOptions,
): TestProjectInlineConfiguration {
    return mergeConfig(projectDefaults(), {
        test: {
            ...(options.exclude === undefined ? {} : { exclude: options.exclude }),
            include: options.include ?? [`specs/${facet}/**/*.spec.ts`],
            ...(options.serial === true ? { fileParallelism: false } : {}),
            name: facet,
            sequence: { groupOrder: 0 },
            ...(options.timeout === undefined ? {} : { testTimeout: options.timeout }),
        },
    }) as TestProjectInlineConfiguration;
}
