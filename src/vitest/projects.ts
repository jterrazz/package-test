import type { TestProjectInlineConfiguration } from 'vitest/config';

import type { FacetProjectOptions } from './project-kit.js';
import { onProjectDefaults } from './project-kit.js';

export { api, type ApiProjectOptions } from '../facets/api/api.project.js';
export {
    cli,
    type CliProjectOptions,
    literate,
    type LiterateDoor,
    type LiterateOptions,
    type LiteratePlugin,
} from '../facets/cli/cli.project.js';
export { component, type ComponentProjectOptions } from '../facets/component/component.project.js';
export {
    integration,
    type IntegrationProjectOptions,
} from '../facets/integration/integration.project.js';
export { job, type JobProjectOptions } from '../facets/job/job.project.js';
export { mobile, type MobileProjectOptions } from '../facets/mobile/mobile.project.js';
export { website, type WebsiteProjectOptions } from '../facets/website/website.project.js';
export { type FacetProjectOptions } from './project-kit.js';

/** `unit()` — module tests, beside the modules they cover (CONVENTIONS I2). */
export type UnitProjectOptions = FacetProjectOptions & {
    /** `false` shares one module graph per worker (`isolate: false`); for pure projects only. */
    isolate?: boolean;
    /** Trees module tests live in, when not `src/`. */
    roots?: string[];
};

/** `.test.tsx` is excluded: a rendered thing is a component test, and the dependency scan would optimise it for a page that never opens. */
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
