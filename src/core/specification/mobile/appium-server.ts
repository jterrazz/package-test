import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ServeAdapter } from '../website/serve.adapter.js';

const APPIUM_READY_TIMEOUT_MS = 60_000;

/**
 * The guidance thrown when the optional peers are missing — the exact fix,
 * mirroring the playwright message on `.visit()`.
 */
export const APPIUM_INSTALL_HINT =
    'specification.mobile() requires appium and webdriverio (optional peer dependencies): npm install -D appium webdriverio && npx appium driver install xcuitest';

/** A running appium server: its base URL and a group-killing stop. */
export interface AppiumServer {
    stop: () => Promise<void>;
    url: string;
}

/**
 * Start the caller project's appium server as a child process on a free port
 * and wait until `/status` answers. The binary is resolved from the project
 * root's `node_modules/.bin` — appium is an optional peer, so its absence
 * refuses with the exact install command. Process lifecycle (free port via
 * `PORT`, readiness poll, SIGTERM→SIGKILL group escalation on stop) is the
 * serve adapter's — one implementation for every child the framework spawns.
 */
export async function startAppiumServer(root: string): Promise<AppiumServer> {
    const bin = resolve(root, 'node_modules', '.bin', 'appium');
    if (!existsSync(bin)) {
        throw new Error(APPIUM_INSTALL_HINT);
    }

    const serve = new ServeAdapter(
        // The serve adapter injects its free port as `PORT`; appium only
        // Reads a flag, so the shell forwards one into the other.
        { command: `"${bin}" --port "$PORT"`, ready: '/status', timeout: APPIUM_READY_TIMEOUT_MS },
        root,
        'mobile',
    );
    const url = await serve.start();
    return { stop: () => serve.stop(), url };
}
