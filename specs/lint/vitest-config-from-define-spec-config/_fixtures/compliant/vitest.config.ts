import { defineSpecConfig } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        include: ['src/**/*.test.ts'], // oxlint-disable-line jterrazz/include-points-at-a-folder -- an input tree of the vitest-config-from-define-spec-config spec: this rule is incidental to the one it feeds
    },
});
