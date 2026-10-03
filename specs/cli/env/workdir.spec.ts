import { directory } from '@jterrazz/test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { cli } from '../cli.specification.js';
// invariant: a single SQL database: DB_URL and the unambiguous DATABASE_URL are both injected (`service-urls-injected`).

/* invariant: the `env` fixture dumps the whole child environment, ephemeral ports included: each test probes its one variable (`output-asserted-as-a-golden` scalpel). */

/** macOS's own `$TMPDIR` shape (`/var` → `/private/var`), made explicit so the guard holds on Linux: only the resolved spelling is what a child reports. */
async function underSymlinkedTmp<T>(action: () => Promise<T>): Promise<T> {
    const realTmp = realpathSync(tmpdir());
    const base = mkdtempSync(resolve(realTmp, 'spec-symlinked-'));
    const target = resolve(base, 'real');
    const link = resolve(base, 'link');
    mkdirSync(target);
    symlinkSync(target, link, 'dir');
    vi.stubEnv('TMPDIR', link);
    try {
        return await action();
    } finally {
        vi.unstubAllEnvs();
        rmSync(base, { force: true, recursive: true });
    }
}

describe('workdir', () => {
    test('$WORKDIR expands to the path {{workdir}} holds, symlinked tmp or not', async () => {
        // Given - a nested path handed to the child through .env(), under a temp root whose raw spelling differs from its resolved one
        const result = await underSymlinkedTmp(
            async () =>
                await cli
                    .fixture(directory('../_fixtures/specimen-cli/'))
                    .env({ CACHE_DIR: '$WORKDIR/sub' })
                    .exec('workdir-var'),
        );

        // Then - what the child echoes back matches the {{workdir}} golden
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            CACHE_DIR={{workdir}}/sub
        `);
    });
});
