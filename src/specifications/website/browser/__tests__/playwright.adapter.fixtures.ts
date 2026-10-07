import type { PlaywrightAdapter } from '../playwright.adapter.js';

type Browser = Awaited<
    ReturnType<
        NonNullable<NonNullable<ConstructorParameters<typeof PlaywrightAdapter>[0]>['launch']>
    >
>;

function isBrowser(value: object): value is Browser {
    return 'newContext' in value && 'on' in value;
}

type Handler = (event: unknown) => void;

type RoutedRequest = {
    abort: () => Promise<void>;
    continue: () => Promise<void>;
    request: () => { url: () => string };
};

type Route = (route: RoutedRequest) => void;

/** `hold` makes every visit a load that never finishes; `requests` are what the page asks once loading; `status` what the navigation answers, none when absent. */
export type StubPage = { hold?: boolean; requests?: string[]; status?: number };

/** Every call the adapter makes, one line each, and the state a test reads back. */
type Recorder = {
    /** Each context the browser opened, by how many times it was closed. */
    closes: number[];
    launches: number;
    loads: number;
    log: string[];
    shots: string[];
    waiters: { count: number; resolve: () => void }[];
};

/** A stub launcher, no chromium started. */
export type StubChromium = {
    closes: number[];
    launch: () => Promise<Browser>;
    launches: () => number;
    /** Resolves once this many visits are loading. */
    loading: (count: number) => Promise<void>;
    log: string[];
    shots: string[];
};

const NEVER = Promise.withResolvers<never>().promise;

function routedRequest(log: string[], url: string): RoutedRequest {
    return {
        abort: async () => {
            log.push(`abort ${url}`);
            await Promise.resolve();
        },
        continue: async () => {
            log.push(`continue ${url}`);
            await Promise.resolve();
        },
        request: () => ({ url: () => url }),
    };
}

function loaded(recorder: Recorder): void {
    recorder.loads += 1;
    for (const waiter of recorder.waiters.filter((entry) => entry.count <= recorder.loads)) {
        waiter.resolve();
    }
}

function navigation(
    recorder: Recorder,
    page: StubPage,
    routes: Route[],
    handlers: Map<string, Handler>,
): (url: string, settings: object) => Promise<null | { status: () => number }> {
    const { hold = false, requests = [], status } = page;
    return async (url, settings) => {
        recorder.log.push(`goto ${url} ${JSON.stringify(settings)}`);
        for (const route of routes) {
            for (const request of requests) {
                route(routedRequest(recorder.log, request));
            }
        }
        handlers.get('console')?.({ text: () => 'hello', type: () => 'warning' });
        handlers.get('pageerror')?.(new TypeError('boom'));
        loaded(recorder);
        if (hold) {
            return await NEVER;
        }
        return status === undefined ? null : { status: () => status };
    };
}

function stubPage(recorder: Recorder, page: StubPage, routes: Route[]): object {
    const handlers = new Map<string, Handler>();
    return {
        clock: {
            setFixedTime: async (time: Date) => {
                recorder.log.push(`clock ${time.toISOString()}`);
                await Promise.resolve();
            },
        },
        evaluate: async () =>
            await Promise.resolve({
                html: '<html></html>',
                jsonLdBlocks: [],
                links: [],
                metas: [],
                text: 'Welcome',
                title: 'Home',
            }),
        goto: navigation(recorder, page, routes, handlers),
        locator: (selector: string) => ({
            ariaSnapshot: async () => await Promise.resolve(`- snapshot of ${selector}`),
        }),
        on: (event: string, handler: Handler) => {
            handlers.set(event, handler);
        },
        screenshot: async ({ fullPage, path }: { fullPage: boolean; path: string }) => {
            recorder.log.push(`screenshot fullPage=${fullPage}`);
            recorder.shots.push(path);
            await Promise.resolve();
        },
        url: () => 'http://site.test/home',
    };
}

function stubContext(recorder: Recorder, page: StubPage, settings: object): object {
    recorder.log.push(`newContext ${JSON.stringify(settings)}`);
    const at = recorder.closes.push(0) - 1;
    const routes: Route[] = [];
    return {
        close: async () => {
            recorder.closes[at] = (recorder.closes[at] ?? 0) + 1;
            await Promise.resolve();
        },
        newPage: async () => await Promise.resolve(stubPage(recorder, page, routes)),
        route: async (pattern: string, route: Route) => {
            recorder.log.push(`route ${pattern}`);
            routes.push(route);
            await Promise.resolve();
        },
    };
}

export function stubChromium(page: StubPage = {}): StubChromium {
    const recorder: Recorder = {
        closes: [],
        launches: 0,
        loads: 0,
        log: [],
        shots: [],
        waiters: [],
    };
    const browser = {
        close: async () => {
            recorder.log.push('browser close');
            await Promise.resolve();
        },
        newContext: async (settings: object) =>
            await Promise.resolve(stubContext(recorder, page, settings)),
        on(): object {
            return this;
        },
    };
    return {
        closes: recorder.closes,
        launch: async () => {
            recorder.launches += 1;
            if (!isBrowser(browser)) {
                throw new Error('the stub browser opens no context');
            }
            return await Promise.resolve(browser);
        },
        launches: () => recorder.launches,
        loading: async (count) => {
            const waiter = Promise.withResolvers<true>();
            const resolve = (): void => {
                waiter.resolve(true);
            };
            recorder.waiters.push({ count, resolve });
            if (recorder.loads >= count) {
                resolve();
            }
            await waiter.promise;
        },
        log: recorder.log,
        shots: recorder.shots,
    };
}
