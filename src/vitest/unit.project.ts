import type { TestProjectInlineConfiguration } from 'vitest/config';

import type { SpecificationProjectOptions } from './project.js';
import { onProjectDefaults, projectTest } from './project.js';

/** `unit()` — module tests, in the `__tests__/` of the folder of the modules they cover (rule `test-in-its-tests-folder`). */
export type UnitProjectOptions = SpecificationProjectOptions & {
    /** `false` shares one module graph per worker (`isolate: false`); for pure projects only. */
    isolate?: boolean;
    /** The trees module tests live in, each collected whole: none, every `.test.ts` outside `specs/`. */
    roots?: string[];
};

/** `.test.tsx` is excluded: a rendered thing is a component test, and the dependency scan would optimise it for a page that never opens. */
export function unit(options: UnitProjectOptions = {}): TestProjectInlineConfiguration {
    const fromRoots = options.roots?.map((root) => `${root.replace(/\/+$/u, '')}/**/*.test.ts`);
    return onProjectDefaults({
        test: {
            ...projectTest('unit', options, {
                exclude:
                    fromRoots === undefined ? ['specs/**', '**/*.test.tsx'] : ['**/*.test.tsx'],
                include: fromRoots ?? ['**/*.test.ts'],
            }),
            // Stryker disable next-line ConditionalExpression: the project's merge drops a key stated as undefined
            ...(options.isolate === undefined ? {} : { isolate: options.isolate }),
        },
    });
}
