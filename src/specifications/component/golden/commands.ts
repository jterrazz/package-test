import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BrowserCommand } from 'vitest/node';

import { invariant, refusal } from '../../../chain/refusals/refusal.js';
import { resolveSpecPath } from '../../../disk/resolved-spec-path.js';
import { writeInPlace } from '../../../expectations/in-place/in-place.js';
import { renderText } from '../../../expectations/in-place/render.js';
import { dragAcross } from '../../../visitor/pointer.js';
import type { DragOrder } from '../../../visitor/pointer.js';

// invariant: `context.page` is the orchestrator frame and answers `- iframe`: the ARIA tree is read on the tester frame. A golden resolves against `context.testPath`, not the project root.

type PlaywrightCommandContext = {
    frame: () => Promise<{
        locator: (selector: string) => { ariaSnapshot: () => Promise<string> };
    }>;
};

function testFile(testPath: string | undefined): string {
    if (testPath === undefined) {
        throw invariant('a golden command reached the server with no test path');
    }
    return testPath;
}

function goldenPath(testPath: string | undefined, name: string): string {
    return resolveSpecPath('toMatch', name, dirname(testFile(testPath)));
}

const ariaTree: BrowserCommand<[], string> = async (context) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the provider merges its own context in at runtime; the playwright one is what `component()` pins
    const frame = await (context as unknown as PlaywrightCommandContext).frame();
    return await frame.locator('body').ariaSnapshot();
};

// invariant: the drag's wait ends this long before the test's budget: its refusal crosses back to the page, which the page's own 100 ms margin does not cover on a loaded machine.
const SERVER_ROUND_TRIP_MS = 1000;

// invariant: the mouse is the orchestrator page's, and the locator reaches into the tester frame: its box is read in the page's coordinates, where the mouse moves. A `timeout` of 0 is no deadline, the page's answer when no test is running.
const pointerDrag: BrowserCommand<[string, DragOrder], void> = async (context, selector, order) => {
    const { timeout = 0 } = order;
    await dragAcross(
        { locator: context.iframe.locator(selector), mouse: context.page.mouse },
        { ...order, timeout: timeout === 0 ? 0 : Math.max(timeout - SERVER_ROUND_TRIP_MS, 1) },
    );
};

const goldenRead: BrowserCommand<[string], null | string> = (context, name) => {
    const path = goldenPath(context.testPath, name);
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
};

const goldenWrite: BrowserCommand<[string, string], string> = (context, name, content) => {
    const path = goldenPath(context.testPath, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return path;
};

// outside: the browser server maps the page's stack back to the test's source.
const inPlaceWrite: BrowserCommand<[string, string], string> = (context, stack, text) => {
    const file = testFile(context.testPath);
    const frame = context.project.browser
        ?.parseStacktrace(stack)
        .find((candidate) => candidate.file === file);
    if (frame === undefined) {
        throw new Error(
            refusal({
                fix: 'call toMatch() from the test file itself, or compare to a golden file: toMatch(file(...))',
                found: 'update mode: no frame of this toMatch call is the test file, so the value in place has nowhere to be written',
                read: 'docs/reference/tokens.md#a-value-written-in-place-is-rewritten-in-the-test',
                why: 'A value written in place is rewritten in the test that states it.',
            }),
        );
    }
    writeInPlace(
        { column: frame.column, file, line: frame.line },
        (indent) => renderText(text, indent),
        context.project.getProvidedContext().inPlaceRewrites,
    );
    return `${file}:${frame.line}`;
};

/** One list, so the names the page calls and the names the project registers cannot drift. */
export const COMPONENT_COMMANDS = { ariaTree, goldenRead, goldenWrite, inPlaceWrite, pointerDrag };

type PageSide<Command> =
    Command extends BrowserCommand<infer Args, infer Result>
        ? (...args: Args) => Promise<Awaited<Result>>
        : never;

type PageCommands = {
    [Name in keyof typeof COMPONENT_COMMANDS]: PageSide<(typeof COMPONENT_COMMANDS)[Name]>;
};

/* outside: a `declare module` merges only from a file that is itself a module: a lone `.d.ts` would lose its `export {}` to a formatter and shadow the module. */
declare module 'vitest/browser' {
    // oxlint-disable-next-line typescript/no-empty-object-type -- `BrowserCommands` is vitest's own interface: only an interface merges into it, and it extends the computed list rather than restating it
    interface BrowserCommands extends PageCommands {}
}
