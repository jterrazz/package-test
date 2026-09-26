import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { setupFiles: ['specs/_shared/_fixtures/shop/cli.sh'] } });
