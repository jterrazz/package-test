/** The names each spec subpath of `@jterrazz/test` publishes and the root does not: a meta-test holds the lists to `src/index.services.ts` and `src/index.stubs.ts`. */
export const SUBPATH_NAMES: Readonly<Record<string, readonly string[]>> = {
    '@jterrazz/test/services': [
        'ContainerOptions',
        'ContainerPort',
        'DatabaseKeys',
        'DatabasePort',
        'IsolationStrategy',
        'PostgresOptions',
        'ProcessHandle',
        'ProcessOptions',
        'RedisOptions',
        'SeedSource',
        'ServiceHandle',
        'ServiceRecord',
        'SqliteOptions',
        'postgres',
        'process',
        'redis',
        'sqlite',
    ],
    '@jterrazz/test/stubs': [
        'HttpResponseInit',
        'HttpStreamInit',
        'HttpStubFilter',
        'Intercept',
        'InterceptOptions',
        'InterceptScope',
        'MatchableRequest',
        'SseEvent',
        'StreamBody',
        'Stub',
        'StubInput',
        'StubRequest',
        'StubResponder',
        'StubResponse',
        'StubResponseValue',
        'Stubs',
        'TextFilter',
        'anthropic',
        'defineStub',
        'defineStubs',
        'http',
        'intercept',
        'openai',
    ],
};

export const FRAMEWORK_ROOT = '@jterrazz/test';

export function subpathOf(name: string): string | undefined {
    return Object.entries(SUBPATH_NAMES).find(([, names]) => names.includes(name))?.[0];
}
