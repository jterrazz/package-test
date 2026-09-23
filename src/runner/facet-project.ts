import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { literate } from './literate-plugin.js';
import type { LiterateOptions } from './literate-plugin.js';
import { onProjectDefaults } from './preset.js';

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
     * preset's (`fixtures/` and vitest's own), because vite concatenates. On
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
    return onProjectDefaults({
        test: {
            ...(options.exclude === undefined ? {} : { exclude: options.exclude }),
            include: options.include ?? [`specs/${facet}/**/*.spec.ts`],
            ...(options.serial === true ? { fileParallelism: false } : {}),
            name: facet,
            sequence: { groupOrder: 0 },
            ...(options.timeout === undefined ? {} : { testTimeout: options.timeout }),
        },
    });
}

/** The literate door of the facet that reads documents — the cli. */
export type LiterateDoor = {
    /**
     * The door, wired by default: every `specs/<facet>/**\/*.spec.yaml` becomes
     * a test file bound to `specs/<facet>/<facet>.specification.ts`. State
     * `specification` to name another runner, `include` to narrow the glob, or
     * `false` to collect no documents at all.
     */
    literate?: false | Partial<LiterateOptions>;
};

/**
 * A facet project that collects its documents too: a `<case>.spec.yaml` is a
 * test file of its own, so the plugin's glob has to join the include of the
 * project that collects them — never the root config. Called bare, the path
 * convention is assumed: `specs/<facet>/**\/*.spec.yaml`, bound to
 * `./specs/<facet>/<facet>.specification.ts`.
 */
export function documentProject(
    facet: string,
    options: FacetProjectOptions & LiterateDoor,
): TestProjectInlineConfiguration {
    const { literate: door, ...common } = options;
    const project = facetProject(facet, common);
    if (door === false) {
        return project;
    }
    return mergeConfig(project, {
        plugins: [
            literate({
                include: door?.include ?? [`specs/${facet}/**/*.spec.yaml`],
                specification: door?.specification ?? `./specs/${facet}/${facet}.specification.ts`,
            }),
        ],
    }) as TestProjectInlineConfiguration;
}
