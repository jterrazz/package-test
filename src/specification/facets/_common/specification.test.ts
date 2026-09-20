import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { specification } from '../../../index.js';

/** A minimal Hono-compatible app — no infra needed. */
const tinyApp = {
    request: () => Response.json({ ok: true }, { status: 200 }),
};

describe('specification.api — the app runs in this process', () => {
    let emptyRoot: string;

    beforeEach(() => {
        // Given - a root that declares itself one, and nothing else
        emptyRoot = mkdtempSync(resolve(tmpdir(), 'api-root-'));
        writeFileSync(resolve(emptyRoot, 'package.json'), '{"name":"tmp"}');
    });

    afterEach(() => {
        rmSync(emptyRoot, { force: true, recursive: true });
    });

    test('serves the app the constructor was handed, in-process', async () => {
        // Given - a server factory and no declared service
        const { api, cleanup } = await specification.api({
            root: emptyRoot,
            server: () => tinyApp,
        });

        try {
            // Then - a request reaches the app without a socket
            const result = await api.get('/anything');
            expect(result.status).toBe(200);
        } finally {
            await cleanup();
        }
    });

    test('the server factory is the constructor one required option', async () => {
        // Given - a call that omits it (the shape compose mode once allowed, where the app ran in a container instead of in this process)
        // @ts-expect-error - `server` is required; this line is the guard
        const started = specification.api({ root: emptyRoot });

        // Then - the compiler refuses it, and the guard fails the typecheck if the option ever becomes optional again; at runtime there is no second path to fall back to
        await expect(started).rejects.toThrow('options.server is not a function');
    });
});
