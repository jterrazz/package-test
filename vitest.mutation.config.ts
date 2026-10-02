import type { Plugin } from 'vitest/config';
import { mergeConfig } from 'vitest/config';

import { defineSpecConfig, unit } from './src/index.vitest.js';

// Stryker 10 names a test by its suites and title joined with a space, where Vitest 5 joins them with ` > `: without this, every mutant runs no test and survives.
export const strykerTestNames: Plugin = {
    configureVitest({ project }) {
        let pattern: RegExp | undefined;
        Object.defineProperty(project.config, 'testNamePattern', {
            configurable: true,
            enumerable: true,
            get: () => pattern,
            set: (stated: RegExp | string | undefined) => {
                pattern =
                    stated === undefined
                        ? undefined
                        : new RegExp(
                              (stated instanceof RegExp ? stated.source : stated)
                                  .replaceAll(String.raw`\-`, '-')
                                  .replaceAll(' ', '(?: > | )'),
                              'u',
                          );
            },
        });
    },
    name: 'stryker-test-names',
};

export const moduleTests = mergeConfig(
    unit({
        // What reads the sources as text or as types sees the instrumented ones, and the temp root is the run's own: none of them can judge a mutant.
        exclude: [
            'lint/self/checks/error-is-a-refusal-or-an-invariant.test.ts',
            'lint/self/corpus/docs-typecheck.test.ts',
            'lint/self/corpus/env-allowlist.test.ts',
            'lint/self/corpus/messages.test.ts',
            'lint/self/corpus/type-channel.test.ts',
            'src/chain/paths/temp-root.test.ts',
        ],
        include: ['src/**/*.test.ts', 'lint/**/*.test.ts'],
    }),
    { plugins: [strykerTestNames] },
);

export default defineSpecConfig({ test: { projects: [moduleTests] } });
