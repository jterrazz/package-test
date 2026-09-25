import {
    BROWSER_DESCRIPTORS,
    BROWSER_STATES,
    BROWSER_VERBS,
    DRAWN_DESCRIPTORS,
    DRAWN_VERBS,
    WITHIN,
} from '../../../elements/vocabulary-rows.js';
import { consoleOf, errorsOf } from '../../../expectations/text/console.js';
import { defineAction } from '../../../kernel/chain/action.js';
import type { ChainSignature, MatrixRow } from '../../../kernel/chain/capability.js';
import { recordConsole } from './console-recorder.js';
import type { PagePort } from './page.port.js';
import { RenderResult } from './render.result.js';
import type { ComponentScenario, RenderSubject } from './scenario.js';
import { wrap } from './wrap.capability.js';

/** The verbs only a component's visitor hands out: what a parent does to it. */
const PARENT_VERBS: readonly MatrixRow[] = [
    { group: 'Verb', name: 'rerender', probe: '.rerender(' },
    { group: 'Verb', name: 'unmount', probe: '.unmount(' },
];

/** What a mounted subject offers the render, React or vanilla DOM alike. */
type MountedSurface = Awaited<ReturnType<PagePort['mountDom']>>;

/** A React tree's wrapper, as the chain states it. */
type Wrapper = NonNullable<ReturnType<PagePort['projectWrapper']>>;

/** A React tree, as a wrapper takes and hands it back. */
type Ui = Parameters<Wrapper>[0];

/**
 * What the page is still holding, and the teardown that lets it go.
 *
 * The React adapter's own auto-cleanup is a `beforeEach` registered when its
 * module loads — and this package loads it lazily, INSIDE the first render, so
 * that hook never covers the test that triggered it. The render does the
 * unmount itself, on the test that rendered: two renders' markup sharing one
 * document is how a second `button('Open')` appears and a descriptor that
 * named exactly one element starts refusing.
 */
let mounted: MountedSurface | null = null;

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

/** Is the subject a function that fills a container, rather than a React tree? */
function isDomMount(subject: RenderSubject): subject is Parameters<PagePort['mountDom']>[0] {
    return typeof subject === 'function';
}

/** Mount the subject, dressing a React tree in the chain's wrapper and the project's. */
async function mount(
    page: PagePort,
    chained: null | Wrapper,
    subject: RenderSubject,
): Promise<MountedSurface> {
    if (isDomMount(subject)) {
        return await page.mountDom(subject);
    }
    const outer = page.projectWrapper();
    const dress = (ui: Ui): Ui => {
        const inner = chained ? chained(ui) : ui;
        return outer ? outer(inner) : inner;
    };
    const surface = await page.mountReact(dress(subject));
    return {
        ...surface,
        rerender: async (ui) => {
            await surface.rerender(dress(ui));
        },
    };
}

/** What `.render()` puts on a chain. */
export type RenderSignature = ChainSignature & {
    readonly chain: {
        /** Mount the subject, run the scenario, and capture what the page shows. */
        render: (subject: RenderSubject, scenario?: ComponentScenario) => Promise<RenderResult>;
    };
};

/**
 * `.render(subject, scenario?)`: mount the subject, run the scenario (the
 * When), and capture what the page shows. A second render in one test
 * replaces the first: two mounts sharing one document is how a descriptor
 * that named exactly one element starts refusing, and the teardown only ever
 * sees the last surface. The first surface is taken down before the second
 * render arms anything, so what it does as it leaves meets the page it lived
 * on, not the next render's viewport, stubs or clock.
 */
export const render = defineAction<
    'render',
    [subject: RenderSubject, scenario?: ComponentScenario],
    RenderResult,
    RenderSignature,
    { page: PagePort }
>({
    accessors: [
        { group: 'Result accessor', name: '.tree', probe: 'result.tree' },
        { group: 'Result accessor', name: '.content', probe: 'result.content' },
        { group: 'Result accessor', name: '.console', probe: 'result.console' },
        { group: 'Result accessor', name: '.errors', probe: 'result.errors' },
        { group: 'Result accessor', name: '.html', probe: 'result.html' },
    ],
    descriptors: [...DRAWN_DESCRIPTORS, ...BROWSER_DESCRIPTORS, WITHIN, ...BROWSER_STATES],
    name: 'render',
    perform: async ([subject, scenario], read, { page }) => {
        const recorder = recordConsole();
        page.afterThisTest(async () => {
            recorder.stop();
            await unmountHeld();
        });

        const surface = await mount(page, read(wrap), subject);
        mounted = surface;

        try {
            if (scenario) {
                await scenario(await page.visitor(surface));
            }
        } finally {
            recorder.stop();
        }

        const { entries } = recorder;
        return new RenderResult({
            console: consoleOf(entries),
            // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- RENDERED text is the subject: `textContent` carries a `<style>` body and every node the page does not display, and the website twin reads `innerText` for the same reason
            content: document.body.innerText,
            errors: errorsOf(entries),
            html: surface.container.innerHTML,
            tree: await page.ariaTree(),
        });
    },
    prepare: async () => {
        await unmountHeld();
        return { workDir: null };
    },
    row: { group: 'Terminal action', name: '.render()', probe: '.render(' },
    verbs: [...DRAWN_VERBS, ...BROWSER_VERBS, ...PARENT_VERBS],
});
