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

    test('requires a root — the caller resolved it, there is no second opinion', () => {
        // Given - a construction that omits the root (the shape that used to fall back to `process.cwd()`, silently disagreeing with the runner's own A9 walk from the calling specification file)
        // @ts-expect-error - `root` is required; this line is the guard
        const orchestrator = new Orchestrator({ services: {} });

        // Then - the type refuses it, and the guard fails the typecheck if the option ever becomes optional again
        expect(orchestrator).toBeInstanceOf(Orchestrator);
    });

    test('starts nothing when a record declares nothing', async () => {
        // Given - a stack with an empty services record
        const orchestrator = new Orchestrator({ root: elsewhere, services: {} });
        await orchestrator.start();

        try {
            // Then - there is no default database to hand back
            expect(orchestrator.getDatabase()).toBeNull();
            expect(orchestrator.getDatabases().size).toBe(0);
        } finally {
            await orchestrator.stop();
        }
    });
});
