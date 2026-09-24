import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';
// A runner with a single SQL database — DB_URL and the unambiguous
// DATABASE_URL alias are both injected (CONVENTIONS B6).
// A runner declaring `defaults` — the env every one of its runs starts with.

/*
 * Scalpel by design: the `env` fixture dumps the whole child environment (PATH, HOME,
 * temp workdirs, injected service URLs with ephemeral ports) — a full snapshot is
 * unstable by nature. Each test probes the one variable whose injection/merge/unset
 * behaviour it exercises.
 */

/**
 * Run `action` with the runner's temp root reached through a SYMLINK — macOS's
 * own `$TMPDIR` shape (`/var` → `/private/var`), made explicit so the guard
 * holds on Linux too. Every workdir minted inside it then has two spellings,
 * and only the resolved one is what a child process reports.
 */
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

describe('env', () => {
    test('$WORKDIR expands to the path {{workdir}} holds, symlinked tmp or not', async () => {
        // Given - a nested path handed to the child through .env(), under a temp root whose raw spelling differs from its resolved one
        const result = await underSymlinkedTmp(
            async () =>
                await cli
                    .fixture(directory('../../shared/fixtures/specimen-cli/'))
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
