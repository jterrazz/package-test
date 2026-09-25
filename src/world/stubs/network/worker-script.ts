import { createRequire } from 'node:module';

/** From this package's own install: `@vitest/browser` resolves it only where the installer hoists, and a consumer declaring `msw` is what F8 forbids. */
export function mswWorkerScript(): string {
    return createRequire(import.meta.url).resolve('msw/mockServiceWorker.js');
}
