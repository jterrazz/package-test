import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { Orchestrator } from './orchestrator.js';

describe('the orchestrator measures from the root it is given', () => {
    const elsewhere = mkdtempSync(resolve(tmpdir(), 'orchestrator-root-'));

    afterAll(() => {
        rmSync(elsewhere, { force: true, recursive: true });
    });

    test('looks for the compose file under that root, not the working directory', async () => {
        // Given - a root with no compose file, while the process runs somewhere else
        const orchestrator = new Orchestrator({ mode: 'e2e', root: elsewhere, services: {} });

        // Then - the refusal names the declared root: nothing consults the cwd
        await expect(orchestrator.startCompose()).rejects.toThrow(
            `no compose file found in ${elsewhere}`,
        );
    });

    test('requires a root — the caller resolved it, there is no second opinion', () => {
        // Given - a construction that omits the root (the shape that used to
        // Fall back to `process.cwd()`, silently disagreeing with the runner's
        // Own A9 walk from the calling specification file)
        // @ts-expect-error - `root` is required; this line is the guard
        const orchestrator = new Orchestrator({ mode: 'integration', services: {} });

        // Then - the type refuses it, and the guard fails the typecheck if the
        // Option ever becomes optional again
        expect(orchestrator).toBeInstanceOf(Orchestrator);
    });
});
