import { registerWorkerContracts, resetWorkerContracts } from '../../../integrations/msw/worker.js';
import {
    afterThisTest,
    pinClock,
    providedClock,
    providedWrapPath,
    releaseClock,
} from '../../../integrations/vitest-browser/page-runtime.js';
import type { ComponentUi, DomMount } from '../../../integrations/vitest-browser/ui.js';
import {
    ariaTree,
    componentVerbs,
    mountDom,
    mountReact,
} from '../../../integrations/vitest-browser/vitest-browser.adapter.js';
import type { MountedSurface } from '../../../integrations/vitest-browser/vitest-browser.adapter.js';
import { contractsOf, isContract, isContracts } from '../../contracts/contract.js';
import type { Contract, ContractInput } from '../../contracts/contract.js';
import type {
    ContractRequest,
    ContractResponder,
    ContractResponse,
} from '../../contracts/types.js';
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
    wrap: ((ui: ComponentUi) => ComponentUi) | null;
};

const EMPTY: ChainState = { clock: null, contracts: [], wrap: null };

/**
 * The project-level `wrap`, loaded once from the module path `component()`
 * provided. It is a URL the dev server serves, not a filesystem path: inside a
 * page there is nothing else to import.
 */
let projectWrap: ((ui: ComponentUi) => ComponentUi) | null = null;
let projectWrapLoaded = false;

async function loadProjectWrap(): Promise<((ui: ComponentUi) => ComponentUi) | null> {
    if (projectWrapLoaded) {
        return projectWrap;
    }
    projectWrapLoaded = true;
    const path = providedWrapPath();
    if (path === undefined || path === '') {
        return null;
    }
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- a specifier known only at runtime resolves to `any`: the shape is checked on the next line, which is the whole contract of `wrap`
    const module: { default?: (ui: ComponentUi) => ComponentUi } = await import(
        /* @vite-ignore */
        path
    );
    if (typeof module.default !== 'function') {
        throw new TypeError(
            `component({ wrap: '${path}' }): the module must default-export (ui) => ReactNode.`,
        );
    }
    projectWrap = module.default;
    return projectWrap;
}

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

/** Everything one test may have left behind, undone — no hook in any spec. */
function resetComponentScope(): void {
    resetWorkerContracts();
    releaseClock();
}

/** Mount the subject, dressing a React tree in the chain's wrapper and the project's. */
async function mount(state: ChainState, subject: RenderSubject): Promise<MountedSurface> {
    if (isDomMount(subject)) {
        return mountDom(subject);
    }
    const outer = await loadProjectWrap();
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
    const recorder = recordConsole();
    afterThisTest(() => {
        recorder.stop();
        resetComponentScope();
    });

    const instant = state.clock ?? providedClock();
    if (instant !== undefined) {
        pinClock(instant);
    }

    const registration = await registerWorkerContracts(state.contracts);
    const surface = await mount(state, subject);

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
        content: document.body.textContent,
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
        wrap: (wrapper) => chainOf({ ...state, wrap: wrapper }),
    };
}

/** The handle a component test imports. */
export const component: ComponentChain = chainOf(EMPTY);
