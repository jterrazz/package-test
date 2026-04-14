/**
 * Target factories for {@link spec}. Each target describes what is being tested
 * and how the specification runner should connect to it.
 */

import type { ServiceHandle } from '../spec/common/ports/service.port.js';

/** Any object with a request method compatible with Hono's app.request(). */
type HonoApp = {
    request: (path: string, init?: RequestInit) => Promise<Response> | Response;
};

/** A named job that can be triggered via .job(). */
export interface JobHandle {
    name: string;
    execute: () => Promise<void>;
}

/** Services map passed to the app factory after infrastructure starts. */
export type AppServices = Record<string, ServiceHandle>;

/**
 * Return value from the app() factory. Either a bare server (backward compat)
 * or an object with server + jobs for job-based testing.
 */
export type AppFactoryResult = HonoApp | { server: HonoApp; jobs: JobHandle[] };

// ── Target types ──

/** In-process Hono app target. Created by {@link app}. */
export interface AppTarget {
    readonly kind: 'app';
    readonly factory: (services: AppServices) => AppFactoryResult;
}

/** Docker compose stack target. Created by {@link stack}. */
export interface StackTarget {
    readonly kind: 'stack';
    readonly root: string;
}

/** CLI command target. Created by {@link command}. */
export interface CommandTarget {
    readonly kind: 'command';
    readonly bin: string;
}

/** Any target that produces an HTTP interface (app or stack). */
export type HttpTarget = AppTarget | StackTarget;

/** Any valid spec target. */
export type SpecTarget = AppTarget | CommandTarget | StackTarget;

// ── Target factories ──

/**
 * Test against an in-process Hono app. The factory receives started services
 * so you can wire connection strings into your app/DI container.
 *
 * @param factory - Function that receives services and returns a Hono app instance.
 *
 * @example
 *   const db = postgres({ compose: 'db' });
 *   await spec(
 *       app((services) => createApp({ databaseUrl: services.db.connectionString })),
 *       { services: [db] },
 *   );
 */
export function app(factory: (services: AppServices) => HonoApp): AppTarget {
    return { kind: 'app', factory };
}

/**
 * Test against a full docker compose stack. The stack is started with
 * `docker compose up` and real HTTP requests are sent to the app service.
 *
 * @param root - Project root containing `docker/compose.test.yaml`.
 *
 * @example
 *   await spec(stack('../../'));
 */
export function stack(root: string): StackTarget {
    return { kind: 'stack', root };
}

/**
 * Test a CLI binary. Each spec runs in a fresh temp directory.
 *
 * @param bin - Path to the CLI binary or command name (resolved from node_modules/.bin or PATH).
 *
 * @example
 *   await spec(command('my-cli'), { root: '../fixtures' });
 */
export function command(bin: string): CommandTarget {
    return { kind: 'command', bin };
}
