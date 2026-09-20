import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import type { FacetProjectOptions } from '../../runner/facet-project.js';
import { projectDefaults } from '../../runner/preset.js';

/** `website()` — the assembled product, met through a served page. */
export type WebsiteProjectOptions = FacetProjectOptions;

/**
 * A website spec meets the assembled product through a served page, in the
 * Chromium playwright drives. It opens a browser, so it is scheduled before the
 * component project and never beside it: two Chromiums must not share a slot on
 * a 2-vCPU runner.
 */
export function website(options: WebsiteProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(projectDefaults(), {
        test: {
            ...(options.exclude === undefined ? {} : { exclude: options.exclude }),
            ...(options.serial === true ? { fileParallelism: false } : {}),
            include: options.include ?? ['specs/website/**/*.spec.ts'],
            name: 'website',
            sequence: { groupOrder: 1 },
            ...(options.timeout === undefined ? {} : { testTimeout: options.timeout }),
        },
    }) as TestProjectInlineConfiguration;
}
