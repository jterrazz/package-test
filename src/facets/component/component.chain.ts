import { contractsOf, isContract, isContracts } from '../../core/contracts/contract.js';
import type { Contract, ContractInput } from '../../core/contracts/contract.js';
import type {
    ContractRequest,
    ContractResponder,
    ContractResponse,
} from '../../core/contracts/types.js';
import { registerWorkerContracts, resetWorkerContracts } from '../../seams/msw/worker.js';
import {
    afterThisTest,
    pinClock,
    projectWrapper,
    providedClock,
    providedViewport,
    releaseClock,
    setViewport,
} from '../../seams/vitest-browser/page-runtime.js';
import type { ComponentUi, DomMount } from '../../seams/vitest-browser/ui.js';
import {
    ariaTree,
    componentVerbs,
    mountDom,
    mountReact,
} from '../../seams/vitest-browser/vitest-browser.adapter.js';
import type { MountedSurface } from '../../seams/vitest-browser/vitest-browser.adapter.js';
import { RenderResult } from './component.result.js';
import type { ComponentChain, ComponentScenario, RenderSubject } from './component.types.js';

/**
 * `component` — the chain a rendered unit is specified through.
 *
 * It is the one facet with no constructor. A component is a UNIT, like a
 * module: there is no server to start, no database to isolate, no binary to
 * find, so there is nothing for a `*.specification.ts` to hold. What such a
 * file WOULD have held — the providers every render needs, the Vite pipeline,
 * the clock, the viewport — belongs to the PROJECT (`component()` in
 * `vitest.config.ts`); what belongs to one test is said on the chain.
 *
 * ```tsx
 * const result = await component
 *     .intercept(listing)
 *     .render(<PostTable />, async (visitor) => {
 *         await visitor.see(content('Showing 2 of 200 posts'));
 *     });
 *
 * await expect(result.tree).toMatch('two-of-two-hundred.aria.yaml');
 * ```
 */

/** One console line, as the page emitted it. */
type ConsoleEntry = { text: string; type: string };

/** The console methods a render records; everything else is left alone. */
const CONSOLE_METHODS = ['debug', 'error', 'info', 'log', 'warn'] as const;

/** One of the five, as a type — what the restore map is keyed by. */
type ConsoleMethod = (typeof CONSOLE_METHODS)[number];

/** What the chain has been told, before anything is mounted. */
type ChainState = {
    clock: null | string;
    contracts: readonly Contract[];
    viewport: null | { height: number; width: number };
    wrap: ((ui: ComponentUi) => ComponentUi) | null;
};

const EMPTY: ChainState = { clock: null, contracts: [], viewport: null, wrap: null };

/** Record what the page writes to the console for the length of the render. */
function recordConsole(): { entries: ConsoleEntry[]; stop: () => void } {
    const entries: ConsoleEntry[] = [];
    const originals = new Map<ConsoleMethod, typeof console.log>();
    for (const method of CONSOLE_METHODS) {
        const original = console[method];
        originals.set(method, original);
        console[method] = (...args: unknown[]): void => {
            entries.push({ text: args.map(String).join(' '), type: method });
            original(...args);
        };
    }
    const onError = (event: ErrorEvent): void => {
        entries.push({ text: event.message, type: 'error' });
    };
    globalThis.addEventListener('error', onError);
    let stopped = false;
    return {
        entries,
        stop: () => {
            if (stopped) {
                return;
            }
            stopped = true;
            for (const method of CONSOLE_METHODS) {
                const original = originals.get(method);
                if (original !== undefined) {
                    console[method] = original;
                }
            }
            globalThis.removeEventListener('error', onError);
        },
    };
}

/** Is the subject a function that fills a container, rather than a React tree? */
function isDomMount(subject: RenderSubject): subject is DomMount {
    return typeof subject === 'function';
}

/** A bare request needs its response — the same refusal every facet gives. */
function inlinePair(
    request: ContractRequest,
    response: ContractResponder | ContractResponse | undefined,
): Contract {
    if (response === undefined) {
        throw new Error(
            '.intercept(): a bare request needs its response — pass a contract ' +
                '(defineContract({ request, response })) or the inline pair .intercept(request, response).',
        );
    }
    return { request, response };
}

/**
 * What the page is still holding, and the teardown that lets it go.
 *
 * The React adapter's own auto-cleanup is a `beforeEach` registered when its
 * module loads — and this package loads it lazily, INSIDE the first render, so
 * that hook never covers the test that triggered it. The seam does the unmount
 * itself, on the test that rendered: two renders' markup sharing one document
 * is how a second `button('Open')` appears and a descriptor that named exactly
 * one element starts refusing.
 */
let mounted: MountedSurface | null = null;

/** Everything one test may have left behind, undone — no hook in any spec. */
async function resetComponentScope(resized: boolean): Promise<void> {
    await unmountHeld();
    if (resized) {
        await setViewport(providedViewport());
    }
    resetWorkerContracts();
    releaseClock();
}

/** Take down whatever is still mounted, and hold nothing afterwards. */
async function unmountHeld(): Promise<void> {
    const surface = mounted;
    mounted = null;
    if (surface !== null) {
        try {
            await surface.unmount();
        } catch {
            // A scenario that already called `visitor.unmount()` has nothing
            // Left to take down, and taking it down twice is not a failure
            // Worth raising from a teardown that has done its job.
        }
    }
}

/** Mount the subject, dressing a React tree in the chain's wrapper and the project's. */
async function mount(state: ChainState, subject: RenderSubject): Promise<MountedSurface> {
    if (isDomMount(subject)) {
        return mountDom(subject);
    }
    const outer = projectWrapper<ComponentUi>();
    const dress = (ui: ComponentUi): ComponentUi => {
        const inner = state.wrap ? state.wrap(ui) : ui;
        return outer ? outer(inner) : inner;
    };
    const surface = await mountReact(dress(subject));
    return {
        ...surface,
        rerender: async (ui) => {
            await surface.rerender(dress(ui));
        },
    };
}

/** The terminal action: mount, run the scenario, capture what the page shows. */
async function render(
    state: ChainState,
    subject: RenderSubject,
    scenario?: ComponentScenario,
): Promise<RenderResult> {
    // A second `.render()` in one test replaces the first: two mounts sharing
    // One document is how a descriptor that named exactly one element starts
    // Refusing, and the teardown only ever sees the last surface.
    await unmountHeld();

    const recorder = recordConsole();
    afterThisTest(async () => {
        recorder.stop();
        await resetComponentScope(state.viewport !== null);
    });

    if (state.viewport !== null) {
        await setViewport(state.viewport);
    }

    const instant = state.clock ?? providedClock();
    if (instant !== undefined) {
        pinClock(instant);
    }

    const registration = await registerWorkerContracts(state.contracts);
    const surface = await mount(state, subject);
    mounted = surface;

    try {
        if (scenario) {
            await scenario(componentVerbs(surface));
        }
    } finally {
        recorder.stop();
    }

    const violation = registration.violation();
    if (violation !== null) {
        throw violation;
    }

    const { entries } = recorder;
    return new RenderResult({
        console: entries.map((entry) => `[${entry.type}] ${entry.text}`).join('\n'),
        // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- RENDERED text is the subject: `textContent` carries a `<style>` body and every node the page does not display, and the website twin reads `innerText` for the same reason
        content: document.body.innerText,
        errors: entries
            .filter((entry) => entry.type === 'error')
            .map((entry) => entry.text)
            .join('\n'),
        html: surface.container.innerHTML,
        tree: await ariaTree(),
    });
}

/** Every setup forks a chain, so the exported handle never carries a test's state. */
function chainOf(state: ChainState): ComponentChain {
    return {
        clock: (iso) => chainOf({ ...state, clock: iso }),
        intercept: (
            requestOrContracts: ContractInput | ContractRequest,
            maybeResponse?: ContractResponder | ContractResponse,
        ): ComponentChain => {
            const added =
                Array.isArray(requestOrContracts) ||
                isContracts(requestOrContracts) ||
                isContract(requestOrContracts)
                    ? contractsOf(requestOrContracts)
                    : [inlinePair(requestOrContracts, maybeResponse)];
            return chainOf({ ...state, contracts: [...state.contracts, ...added] });
        },
        render: async (subject, scenario) => await render(state, subject, scenario),
        viewport: (size) => chainOf({ ...state, viewport: size }),
        wrap: (wrapper) => chainOf({ ...state, wrap: wrapper }),
    };
}

/** The handle a component test imports. */
export const component: ComponentChain = chainOf(EMPTY);
