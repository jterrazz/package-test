import type { ContractInput } from '../../core/contracts/contract.js';
import type {
    ContractRequest,
    ContractResponder,
    ContractResponse,
} from '../../core/contracts/types.js';
import type { ComponentUi, DomMount } from '../../seams/vitest-browser/ui.js';
import type { componentVerbs } from '../../seams/vitest-browser/vitest-browser.adapter.js';
import type { RenderResult } from './component.result.js';

/**
 * The component facet's shape, stated where BOTH runtimes can read it.
 *
 * The page gets the working chain; node gets a stub under the same name and
 * the same type, so a component test that ran in the wrong project fails on
 * the line that rendered rather than on a missing export. The published types
 * are the node build's, so this file is the one description of the facet.
 */

/** The interaction vocabulary a render scenario is handed — the When. */
export type ComponentVisitor = ReturnType<typeof componentVerbs>;

/** The behaviour of a render; assertions stay in the Then, on the result (W1). */
export type ComponentScenario = (visitor: ComponentVisitor) => Promise<void>;

/**
 * What `.render()` mounts. A React tree is an element (`<PostTable />`); a
 * vanilla DOM subject is the FUNCTION that fills a container, which is how a
 * DOM-only module is called in production too.
 */
export type RenderSubject = ComponentUi | DomMount;

/**
 * The chain. Every setup returns a new one, so the handle a spec imports never
 * carries the previous test's contracts, wrapper or clock.
 */
export type ComponentChain = {
    /** Pin the page's `Date` for this render — the clock the component reads. */
    clock: (iso: string) => ComponentChain;
    /**
     * Declare what the network replies — the same contracts, the same queue
     * and the same strictness as every other facet (D7), served by msw's
     * worker instead of its node interceptor.
     */
    intercept: {
        (contracts: ContractInput): ComponentChain;
        (request: ContractRequest, response: ContractResponder | ContractResponse): ComponentChain;
    };
    /** Mount the subject, run the scenario, and capture what the page shows. */
    render: (subject: RenderSubject, scenario?: ComponentScenario) => Promise<RenderResult>;
    /**
     * The page size THIS render gets — the Given of a component that reads
     * `matchMedia` or a container query. The project's size is restored when
     * the test ends, so a narrow render never leaks into the next one.
     */
    viewport: (size: { height: number; width: number }) => ComponentChain;
    /**
     * Wrap every render of this chain — the test-local Given a router stub or
     * a `<StrictMode>` is. The project's own `wrap` stays outermost: it is the
     * app's frame, and one test does not get to sit outside it.
     */
    wrap: (wrapper: (ui: ComponentUi) => ComponentUi) => ComponentChain;
};
