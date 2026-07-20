import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Directory of the running framework module itself. From the built package
 * this is `<package root>/dist`, whatever the resolution path — including a
 * `file:` link, where the real path carries neither `node_modules` nor
 * `/src/…` and would otherwise be mistaken for a caller frame.
 */
const FRAMEWORK_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Detect the directory of the first stack frame that lives outside this
 * package. Used to anchor fixture resolution (`seeds/`, `requests/`,
 * `expected/`, …) on the calling test / specification file.
 *
 * @internal
 */
export function getCallerDir(): string {
    const stack = new Error('caller detection').stack;
    if (!stack) {
        throw new Error('Cannot detect caller directory: no stack trace');
    }

    const lines = stack.split('\n');
    for (const line of lines) {
        const match = line.match(/at\s+(?:.*?\()?(?:file:\/\/)?(?<filePath>[^:)]+):\d+:\d+/);
        if (!match?.groups?.filePath) {
            continue;
        }

        const filePath = match.groups.filePath;

        if (filePath.includes('node_modules')) {
            continue;
        }
        // Framework-internal frames are skipped.
        // Sibling module tests (`src/**/<file>.test.ts`) are callers, not internals (I2).
        if (
            (filePath.includes('/src/core/') ||
                filePath.includes('/src/integrations/') ||
                filePath.includes('/src/vitest/') ||
                resolve(filePath, '..') === FRAMEWORK_DIR) &&
            !/\.test\.[cm]?[jt]s$/.test(filePath)
        ) {
            continue;
        }

        return resolve(filePath, '..');
    }

    // Every frame is framework- or package-internal: the chain was started
    // By code living in node_modules (e.g. a published rule pack declaring
    // Tests itself). There is no consumer test file to anchor on — fall back
    // To the working directory; such packs assert on results directly and
    // Never resolve `expected/` fixtures.
    return process.cwd();
}
