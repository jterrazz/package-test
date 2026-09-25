import { createRequire } from 'node:module';

/**
 * msw's service worker script, from this package's OWN install — the file the
 * page's worker engine registers at `/mockServiceWorker.js`.
 *
 * The package that owns the `msw` dependency is the one that can always find
 * it: `@vitest/browser` resolves the same path from its own directory, and it
 * does not depend on `msw`, so that resolution only lands where the installer
 * hoists. Without this one, a consumer runs `msw init` and declares `msw`,
 * which F8 forbids.
 */
export function mswWorkerScript(): string {
    return createRequire(import.meta.url).resolve('msw/mockServiceWorker.js');
}
