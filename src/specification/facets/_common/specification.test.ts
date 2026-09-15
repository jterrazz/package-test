import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { specification } from '../../../index.js';

/** A minimal Hono-compatible app — no infra needed. */
const tinyApp = {
    request: () => Response.json({ ok: true }, { status: 200 }),
};

describe('mode resolution', () => {
    let emptyRoot: string;
    let savedTestMode: string | undefined;

    beforeEach(() => {
        // Given - a root with a package.json but no compose file
        emptyRoot = mkdtempSync(resolve(tmpdir(), 'mode-root-'));
        writeFileSync(resolve(emptyRoot, 'package.json'), '{"name":"tmp"}');
        savedTestMode = process.env.TEST_MODE;
        delete process.env.TEST_MODE;
    });

    afterEach(() => {
        rmSync(emptyRoot, { force: true, recursive: true });
        if (savedTestMode === undefined) {
            delete process.env.TEST_MODE;
        } else {
            process.env.TEST_MODE = savedTestMode;
        }
    });

    test('defaults to node mode and runs the app in-process', async () => {
        // Given - no mode option and no TEST_MODE
        const { api, cleanup } = await specification.api({
            root: emptyRoot,
            server: () => tinyApp,
        });

        try {
            // Then - requests are served in-process
            const result = await api.get('/anything');
            expect(result.status).toBe(200);
        } finally {
            await cleanup();
        }
    });

    test('node mode requires the server option', async () => {
        // Given - node mode without a server factory
        // Then - a clear error explains what is missing
        await expect(specification.api({ root: emptyRoot })).rejects.toThrow(
            "specification.api(): 'server' is required in node mode",
        );
    });

    test('options.mode compose is honored', async () => {
        // Given - explicit compose mode on a root without a compose file
        // Then - the compose path is taken (and fails on the missing file)
        await expect(specification.api({ mode: 'compose', root: emptyRoot })).rejects.toThrow(
            'no compose file found',
        );
    });

    test('honors TEST_MODE=compose when options.mode is absent', async () => {
        // Given - TEST_MODE set in the environment
        process.env.TEST_MODE = 'compose';

        // Then - the compose path is taken
        await expect(specification.api({ root: emptyRoot, server: () => tinyApp })).rejects.toThrow(
            'no compose file found',
        );
    });

    test('options.mode wins over TEST_MODE', async () => {
        // Given - conflicting option and env var
        process.env.TEST_MODE = 'compose';
        const { api, cleanup } = await specification.api({
            mode: 'node',
            root: emptyRoot,
            server: () => tinyApp,
        });

        try {
            // Then - node mode ran (in-process request works)
            const result = await api.get('/anything');
            expect(result.status).toBe(200);
        } finally {
            await cleanup();
        }
    });

    test('rejects invalid mode values', async () => {
        // Given - a bogus TEST_MODE
        process.env.TEST_MODE = 'warp';

        // Then - the error names the accepted values
        await expect(specification.api({ root: emptyRoot, server: () => tinyApp })).rejects.toThrow(
            "Invalid test mode \"warp\" — expected 'node' or 'compose'",
        );
    });
});
