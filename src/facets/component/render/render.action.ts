import { consoleOf, errorsOf } from '../../../expectations/text/console.js';
import { defineAction } from '../../../kernel/chain/action.js';
import type { ChainSignature, MatrixRow } from '../../../kernel/chain/capability.js';
import {
    BROWSER_STATES,
    BROWSER_TARGETS,
    BROWSER_VERBS,
    EVERY_SURFACE_TARGETS,
    EVERY_SURFACE_VERBS,
    WITHIN,
} from '../../../visitor/matrix.js';
import { recordConsole } from './console-recorder.js';
import type { PagePort } from './page.port.js';
import { RenderResult } from './render.result.js';
import type { ComponentScenario, RenderSubject } from './scenario.js';
import { wrap } from './wrap.capability.js';

const PARENT_VERBS: readonly MatrixRow[] = [
    { group: 'Verb', name: 'rerender', probe: '.rerender(' },
    { group: 'Verb', name: 'unmount', probe: '.unmount(' },
];

type MountedSurface = Awaited<ReturnType<PagePort['mountDom']>>;

type Wrapper = NonNullable<ReturnType<PagePort['projectWrapper']>>;

type Ui = Parameters<Wrapper>[0];

/** The React adapter's auto-cleanup `beforeEach` is registered at load, inside the first render, so never covers it: the render unmounts itself. */
let mounted: MountedSurface | null = null;

async function unmountHeld(): Promise<void> {
    const surface = mounted;
    mounted = null;
    if (surface !== null) {
        try {
            await surface.unmount();
        } catch {
            // A scenario that called `visitor.unmount()` already took it down.
        }
    }
}

function isDomMount(subject: RenderSubject): subject is Parameters<PagePort['mountDom']>[0] {
    return typeof subject === 'function';
}

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

export type RenderSignature = ChainSignature & {
    readonly chain: {
        /** Mount the subject, run the scenario, and capture what the page shows. */
        render: (subject: RenderSubject, scenario?: ComponentScenario) => Promise<RenderResult>;
    };
};

/** A second render replaces the first, taken down before the second arms anything. */
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
    targets: [...EVERY_SURFACE_TARGETS, ...BROWSER_TARGETS, WITHIN, ...BROWSER_STATES],
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
    verbs: [...EVERY_SURFACE_VERBS, ...BROWSER_VERBS, ...PARENT_VERBS],
});
