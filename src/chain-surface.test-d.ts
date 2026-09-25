import type { RouteArguments } from './capabilities/params/route.js';
import type {
    ApiSpecification,
    CallResult,
    ChainContext,
    CliEnv,
    CliResult,
    CliSpecification,
    ComponentChain,
    ComponentScenario,
    ComponentUi,
    ContractInput,
    ContractRequest,
    ContractResponder,
    ContractResponse,
    DiskFile,
    DiskTarget,
    ExecOptions,
    FetchResult,
    HttpResult,
    IntegrationSpecification,
    JobsResult,
    JobsSpecification,
    LiterateRunFlags,
    MobileScenario,
    MobileSpecification,
    PageResult,
    RenderResult,
    RenderSubject,
    ScreenResult,
    SeedSource,
    VisitScenario,
    WebsiteSpecification,
} from './index.js';

/**
 * The seven chain types as they were published before the facets were
 * recomposed, frozen, and held equal to the live exports in both directions.
 *
 * The recomposition computes each chain from the list of what its facet
 * composes; a member that is lost, gained or retyped on the way changes the
 * published surface, and this file stops compiling the day it does. It lasts
 * as long as the recomposition: the chain types it freezes are then computed
 * from their compositions alone.
 */

/** Resolves only for `true`. */
type Assert<Row extends true> = Row;

/** Is each type assignable to the other? */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** A member's parameter list — what assignability alone lets a signature drop. */
type ParametersOf<Member> = Parameters<Extract<Member, (...args: never[]) => unknown>>;

/** Mutually assignable, with the same members, each taking the same parameters. */
type Equal<A, B> =
    Same<A, B> extends true
        ? Same<keyof A, keyof B> extends true
            ? false extends {
                  [Key in keyof A & keyof B]: Same<ParametersOf<A[Key]>, ParametersOf<B[Key]>>;
              }[keyof A & keyof B]
                ? false
                : true
            : false
        : false;

type FrozenIntercept<T> = ((contracts: ContractInput) => T) &
    ((request: ContractRequest, response: ContractResponder | ContractResponse) => T);

type FrozenApi<DatabaseKey extends string = string> = {
    clock: (iso: string) => FrozenApi<DatabaseKey>;
    headers: (headers: Record<string, string>) => FrozenApi<DatabaseKey>;
    intercept: FrozenIntercept<FrozenApi<DatabaseKey>>;
    seed: (source: SeedSource, options?: { database?: DatabaseKey }) => FrozenApi<DatabaseKey>;
    delete: <Path extends string>(
        path: Path,
        ...options: RouteArguments<Path>
    ) => Promise<HttpResult>;
    get: <Path extends string>(path: Path, ...options: RouteArguments<Path>) => Promise<HttpResult>;
    post: <Path extends string>(
        path: Path,
        body?: unknown,
        ...options: RouteArguments<Path>
    ) => Promise<HttpResult>;
    put: <Path extends string>(
        path: Path,
        body?: unknown,
        ...options: RouteArguments<Path>
    ) => Promise<HttpResult>;
    request: (source: DiskFile<'.http'> | string) => Promise<HttpResult>;
    with: (context: Pick<ChainContext, 'clock' | 'headers'>) => FrozenApi<DatabaseKey>;
};

type FrozenJobs<DatabaseKey extends string = string> = {
    clock: (iso: string) => FrozenJobs<DatabaseKey>;
    intercept: FrozenIntercept<FrozenJobs<DatabaseKey>>;
    seed: (source: SeedSource, options?: { database?: DatabaseKey }) => FrozenJobs<DatabaseKey>;
    trigger: (name: string) => Promise<JobsResult>;
    with: (context: Pick<ChainContext, 'clock'>) => FrozenJobs<DatabaseKey>;
};

type FrozenIntegration<
    Services extends Record<string, unknown> = Record<string, unknown>,
    DatabaseKey extends string = string,
> = {
    clock: (iso: string) => FrozenIntegration<Services, DatabaseKey>;
    intercept: FrozenIntercept<FrozenIntegration<Services, DatabaseKey>>;
    seed: (
        source: SeedSource,
        options?: { database?: DatabaseKey },
    ) => FrozenIntegration<Services, DatabaseKey>;
    call: <T>(subject: (services: Services) => Promise<T> | T) => Promise<CallResult<T>>;
    with: (context: Pick<ChainContext, 'clock'>) => FrozenIntegration<Services, DatabaseKey>;
};

type FrozenCli<DatabaseKey extends string = string> = {
    env: (env: CliEnv) => FrozenCli<DatabaseKey>;
    fixture: (source: DiskTarget) => FrozenCli<DatabaseKey>;
    seed: (source: SeedSource, options?: { database?: DatabaseKey }) => FrozenCli<DatabaseKey>;
    exec: (args?: string | string[], options?: ExecOptions) => Promise<CliResult>;
    run: (document: DiskFile<'.spec.yaml'>, options?: LiterateRunFlags) => Promise<CliResult>;
    with: (context: Pick<ChainContext, 'env'>) => FrozenCli<DatabaseKey>;
};

type FrozenWebsite = {
    clock: (iso: string) => FrozenWebsite;
    headers: (headers: Record<string, string>) => FrozenWebsite;
    intercept: FrozenIntercept<FrozenWebsite>;
    fetch: (path: string) => Promise<FetchResult>;
    visit: (path: string, scenario?: VisitScenario) => Promise<PageResult>;
    with: (context: Pick<ChainContext, 'clock' | 'headers'>) => FrozenWebsite;
};

type FrozenMobile = {
    intercept: FrozenIntercept<FrozenMobile>;
    open: (deepLink?: string, scenario?: MobileScenario) => Promise<ScreenResult>;
};

type FrozenComponent = {
    clock: (iso: string) => FrozenComponent;
    intercept: {
        (contracts: ContractInput): FrozenComponent;
        (request: ContractRequest, response: ContractResponder | ContractResponse): FrozenComponent;
    };
    render: (subject: RenderSubject, scenario?: ComponentScenario) => Promise<RenderResult>;
    viewport: (size: { height: number; width: number }) => FrozenComponent;
    wrap: (wrapper: (ui: ComponentUi) => ComponentUi) => FrozenComponent;
};

// Concrete parameters: the default, a named pair of databases, and none at all.
export type ApiDefault = Assert<Equal<ApiSpecification, FrozenApi>>;
export type ApiNamed = Assert<Equal<ApiSpecification<'cache' | 'db'>, FrozenApi<'cache' | 'db'>>>;
export type ApiNone = Assert<Equal<ApiSpecification<never>, FrozenApi<never>>>;
export type JobsDefault = Assert<Equal<JobsSpecification, FrozenJobs>>;
export type JobsNamed = Assert<
    Equal<JobsSpecification<'cache' | 'db'>, FrozenJobs<'cache' | 'db'>>
>;
export type JobsNone = Assert<Equal<JobsSpecification<never>, FrozenJobs<never>>>;
export type IntegrationDefault = Assert<Equal<IntegrationSpecification, FrozenIntegration>>;
export type IntegrationNamed = Assert<
    Equal<
        IntegrationSpecification<{ db: { url: string } }, 'db'>,
        FrozenIntegration<{ db: { url: string } }, 'db'>
    >
>;
export type IntegrationNone = Assert<
    Equal<
        IntegrationSpecification<Record<string, never>, never>,
        FrozenIntegration<Record<string, never>, never>
    >
>;
export type CliDefault = Assert<Equal<CliSpecification, FrozenCli>>;
export type CliNamed = Assert<Equal<CliSpecification<'cache' | 'db'>, FrozenCli<'cache' | 'db'>>>;
export type CliNone = Assert<Equal<CliSpecification<never>, FrozenCli<never>>>;
export type Website = Assert<Equal<WebsiteSpecification, FrozenWebsite>>;
export type Mobile = Assert<Equal<MobileSpecification, FrozenMobile>>;
export type Component = Assert<Equal<ComponentChain, FrozenComponent>>;

/** Generic parameters: each direction assigned under a parameter the compiler cannot resolve. */
export function genericParameters<
    DatabaseKey extends string,
    Services extends Record<string, unknown>,
>(
    live: {
        api: ApiSpecification<DatabaseKey>;
        cli: CliSpecification<DatabaseKey>;
        integration: IntegrationSpecification<Services, DatabaseKey>;
        jobs: JobsSpecification<DatabaseKey>;
    },
    frozen: {
        api: FrozenApi<DatabaseKey>;
        cli: FrozenCli<DatabaseKey>;
        integration: FrozenIntegration<Services, DatabaseKey>;
        jobs: FrozenJobs<DatabaseKey>;
    },
): [typeof frozen, typeof live] {
    return [live, frozen];
}
