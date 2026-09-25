import type { FacetParams } from '../model/chain/capability.js';
import type { ClockMethod } from './clock/clock.capability.js';
import type { EnvMethod } from './env/env.capability.js';
import type { FixtureMethod } from './fixture/fixture.capability.js';
import type { HeadersMethod } from './headers/headers.capability.js';
import type { InterceptMethod } from './intercept/intercept.capability.js';
import type { SeedMethod } from './seed/seed.capability.js';
import type { ViewportMethod } from './viewport/viewport.capability.js';
import type { WrapMethod } from './wrap/wrap.capability.js';

/**
 * Every setup's signature, by name — what a chain type picks its setups from.
 * `Self` is the chain a setup hands back, `P` the facet's parameters.
 */
export type SetupSignatures<Self, P extends FacetParams> = {
    /** Pin the subject's `Date` at `iso` for this chain — the calendar it reads. */
    clock: ClockMethod<Self>;
    /** Set environment variables on the child process. `$WORKDIR` expands; `null` unsets. */
    env: EnvMethod<Self>;
    /**
     * Lay file state into the working directory before execution: a
     * `directory()`'s CONTENTS are spread into it, a `file()` is copied under
     * its own name. The shared pool is reached by the path that climbs to it.
     * Chained calls layer.
     */
    fixture: FixtureMethod<Self>;
    /** Set HTTP headers for the exchange. Multiple calls merge. */
    headers: HeadersMethod<Self>;
    /** Declare outgoing calls — a stub, a list, a composite, or an inline request + response pair. */
    intercept: InterceptMethod<Self>;
    /** Queue a SQL seed — `file('./seeds/<name>.sql')` — to run before the action. */
    seed: SeedMethod<Self, P['databaseKey']>;
    /**
     * The page size THIS render gets — the Given of a component that reads
     * `matchMedia` or a container query. The project's size is restored when
     * the test ends, so a narrow render never leaks into the next one.
     */
    viewport: ViewportMethod<Self>;
    /**
     * Wrap every render of this chain — the test-local Given a router stub or
     * a `<StrictMode>` is. The project's own `wrap` stays outermost: it is the
     * app's frame, and one test does not get to sit outside it.
     */
    wrap: WrapMethod<Self>;
};
