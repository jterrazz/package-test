import type { TestProjectInlineConfiguration } from 'vitest/config';

import type { FacetProjectOptions } from '../../vitest/project.js';
import { onProjectDefaults } from '../../vitest/project.js';

/** `website()` — the assembled product, met through a served page. */
export type WebsiteProjectOptions = FacetProjectOptions;

/** A website project: scheduled before the component project, never beside it. */
export function website(options: WebsiteProjectOptions = {}): TestProjectInlineConfiguration {
    return onProjectDefaults({
        test: {
            ...(options.exclude === undefined ? {} : { exclude: options.exclude }),
            ...(options.serial === true ? { fileParallelism: false } : {}),
            include: options.include ?? ['specs/website/**/*.spec.ts'],
            name: 'website',
            sequence: { groupOrder: 1 },
            ...(options.timeout === undefined ? {} : { testTimeout: options.timeout }),
        },
    });
}
