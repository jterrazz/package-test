import { defineConfig } from 'vitest/config';

// A config INSIDE the tree it collects — spwn's shape. `unit` names the tests
// That sit beside their modules, so an include rooted in a specs tree is the
// One thing E4w has to see from here (the reach role is `config`).
export default defineConfig({
    test: {
        projects: [{ test: { name: 'unit', include: ['api/**/*.spec.ts'] } }],
    },
});
