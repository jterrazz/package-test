import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BrowserCommand } from 'vitest/node';

import { renderText, writeInPlace } from '../../../expectations/in-place/in-place.js';
import { resolveSpecPath } from '../../../kernel/files/resolve.js';

/**
 * The things a page cannot do for itself, run on the server side of
 * Browser Mode and reached from the page through `server.commands`.
 *
 * **The ARIA tree.** Browser Mode's own locators expose no `ariaSnapshot()`, so
 * the producer is Playwright's, called on the TESTER FRAME — `context.page` is
 * the orchestrator and answers `- iframe` and nothing else. The website facet
 * calls the same Playwright method, so the two facets share one dialect and
 * one golden format.
 *
 * **The golden file.** Vitest's built-in file commands resolve against the
 * project root and obey `server.fs`; a golden resolves against the TEST's own
 * directory (the path is relative to it), which `context.testPath` gives exactly —
 * no `/@fs/` URL to parse, and no dependence on where the project is rooted.
 */

/** The slice of the playwright provider's command context these commands use. */
type PlaywrightCommandContext = {
    frame: () => Promise<{
        locator: (selector: string) => { ariaSnapshot: () => Promise<string> };
    }>;
};

/** Where a golden sits: its path, relative to the test that asked for it. */
function goldenPath(testPath: string | undefined, name: string): string {
    if (testPath === undefined) {
        throw new Error(
            'golden: the command carries no test path — a golden is read from a test file.',
        );
    }
    return resolveSpecPath('toMatch', name, dirname(testPath));
}

/** The ARIA snapshot of the rendered `<body>`, as YAML. */
export const ariaTree: BrowserCommand<[], string> = async (context) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the provider merges its own context in at runtime; the playwright one is what `component()` pins
    const frame = await (context as unknown as PlaywrightCommandContext).frame();
    return await frame.locator('body').ariaSnapshot();
};

/** The golden's current content, or `null` when it does not exist yet. */
export const goldenRead: BrowserCommand<[string], null | string> = (context, name) => {
    const path = goldenPath(context.testPath, name);
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
};

/** Write the golden — update mode's half, and the path it wrote, for the message. */
export const goldenWrite: BrowserCommand<[string, string], string> = (context, name, content) => {
    const path = goldenPath(context.testPath, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
    return path;
};

/**
 * Write a text in place — update mode's half for a value the test holds. The
 * page's stack names the call in the module the page ran; the browser server
 * maps it back to the test's own source, and the frame of the test file is
 * the call to rewrite.
 */
export const inPlaceWrite: BrowserCommand<[string, string], string> = (context, stack, text) => {
    const file = context.testPath;
    const frame = context.project.browser
        ?.parseStacktrace(stack)
        .find((candidate) => candidate.file === file);
    if (file === undefined || frame === undefined) {
        throw new Error(
            'update mode: no frame of this toMatch call is the test file — the value in place has nowhere to be written.',
        );
    }
    writeInPlace(
        { column: frame.column, file, line: frame.line },
        (indent) => renderText(text, indent),
        context.project.getProvidedContext().inPlaceRewrites,
    );
    return `${file}:${frame.line}`;
};

/**
 * The commands, as `component()` registers them — one list, so the names the
 * page calls and the names the project registers cannot drift.
 */
export const COMPONENT_COMMANDS = { ariaTree, goldenRead, goldenWrite, inPlaceWrite };
