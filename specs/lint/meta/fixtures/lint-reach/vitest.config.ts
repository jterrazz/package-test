import { defineConfig } from 'vitest/config';

// The shape `vitest-config-from-define-spec-config` refuses — the one rule whose reach is the config role. The
// Sleep and the env assignment here are out of every test rule's reach.
export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
    },
});
