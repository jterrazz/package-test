import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ElementRef } from '../ports/browser.port.js';
import {
    resetSubstringWarnings,
    warnSubstringOnly,
    widenedForWindow,
} from './substring-warning.js';
import type { WindowProbe } from './substring-warning.js';

/** A printer that keeps what it was handed — what the adapters give the window. */
function aPrinter(): { lines: string[]; print: (line: string) => void } {
    const lines: string[] = [];
    return {
        lines,
        print: (line) => {
            lines.push(line);
        },
    };
}

describe('the transitional warning for a name that only matched in part', () => {
    beforeEach(() => {
        resetSubstringWarnings();
    });

    test('names the descriptor, the spelling to write, the fixes and the deadline', async () => {
        // Given - a descriptor that designated nothing as a whole name, and the name that carries it
        const printer = aPrinter();
        await warnSubstringOnly(
            { kind: 'link', name: 'Articles' },
            'http://localhost/ambiguous',
            'Read  Articles ',
            printer.print,
        );

        // Then - the reader has the descriptor, the exact name to write, all three ways out, and the release it disappears in
        const [line] = printer.lines;
        expect(line).toContain(`link('Articles')`);
        expect(line).toContain('matched only as a SUBSTRING');
        expect(line).toContain(`The name to write is 'Read Articles'.`);
        expect(line).toContain('{ exact: false }');
        expect(line).toContain('through 16.x; gone in 17.0');
        expect(line).toContain('http://localhost/ambiguous');
    });

    test('goes to stderr by default — the console is captured and the reporter drops it', async () => {
        // Given - no printer, which is every adapter running on the node side
        const written = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        await warnSubstringOnly({ kind: 'link', name: 'Articles' }, 'http://localhost/');

        // Then - the line is on the one stream a plain `vitest --run` passes through
        expect(String(written.mock.calls[0]?.[0])).toContain(`link('Articles')`);
        expect(String(written.mock.calls[0]?.[0])).toMatch(/\n$/u);
    });

    test('says it once per descriptor — a scenario run ten times has one thing to fix', async () => {
        // Given - the same descriptor reported three times
        const { print } = aPrinter();
        const element = { kind: 'link' as const, name: 'Articles' };

        // Then - only the first one prints
        await expect(warnSubstringOnly(element, 'a', undefined, print)).resolves.toBe(true);
        await expect(warnSubstringOnly(element, 'a', undefined, print)).resolves.toBe(false);
        await expect(warnSubstringOnly(element, 'b', undefined, print)).resolves.toBe(false);
    });

    test('tells two descriptors apart by their scope chain, not just their name', async () => {
        // Given - the same name, one of them scoped to a landmark
        const { print } = aPrinter();
        const bare = { kind: 'link' as const, name: 'Articles' };
        const scoped = { ...bare, scope: { kind: 'navigation' as const } };

        // Then - each is its own thing to fix, so each is reported
        await expect(warnSubstringOnly(bare, 'a', undefined, print)).resolves.toBe(true);
        await expect(warnSubstringOnly(scoped, 'a', undefined, print)).resolves.toBe(true);
    });
});

/** The lines a surface printed, and no descriptor remembered from an earlier case. */
const printed: string[] = [];

/** A surface where `names` are the whole accessible names on screen. */
function surfaceOf(names: string[]): WindowProbe {
    const matching = (element: ElementRef): string[] =>
        names.filter((name) =>
            element.exact === false ? name.includes(element.name ?? '') : name === element.name,
        );
    return {
        count: async (element) => await Promise.resolve(matching(element).length),
        nameOf: async (element) => await Promise.resolve(matching(element)[0]),
        print: (line) => {
            printed.push(line);
        },
        // A surface that is not going anywhere: what is on it now is what is
        // On it when the budget runs out.
        settles: async (element) => await Promise.resolve(matching(element).length > 0),
    };
}

/** No line kept from an earlier case, and no descriptor remembered either. */
function aQuietProcess(): string[] {
    printed.length = 0;
    resetSubstringWarnings();
    return printed;
}

describe('the window — what the descriptor is retried with', () => {
    test('widens the target that missed as a whole name', async () => {
        // Given - a button whose accessible name carries a count the test does not name
        aQuietProcess();
        const surface = surfaceOf(['Experiments 9']);

        // Then - the descriptor to retry with is the same one, matching as a substring
        const widened = await widenedForWindow(
            { kind: 'button', name: 'Experiments' },
            'http://localhost/',
            surface,
        );
        expect(widened).toStrictEqual({ exact: false, kind: 'button', name: 'Experiments' });
    });

    test('widens a SCOPE that missed, which is where a migration hurts most', async () => {
        // Given - a scope naming part of a button's accessible name, and a target that is whole
        aQuietProcess();
        const surface = surfaceOf(['Proof of authorship Verified', 'Verified']);
        const element: ElementRef = {
            kind: 'text',
            name: 'Verified',
            scope: { kind: 'button', name: 'Proof of authorship' },
        };

        // Then - the level that missed is the one that widens, and the target is left alone
        const widened = await widenedForWindow(element, 'http://localhost/', surface);
        expect(widened?.scope).toStrictEqual({
            exact: false,
            kind: 'button',
            name: 'Proof of authorship',
        });
        expect(widened?.exact).toBeUndefined();
    });

    test('leaves a descriptor that states its own `exact` alone', async () => {
        // Given - an author who asked for the whole name
        aQuietProcess();
        const surface = surfaceOf(['Experiments 9']);

        // Then - the window has nothing to say: the choice was made
        const widened = await widenedForWindow(
            { exact: true, kind: 'button', name: 'Experiments' },
            'http://localhost/',
            surface,
        );
        expect(widened).toBeUndefined();
    });

    test('says nothing when the name is on no element at all', async () => {
        // Given - a screen that carries nothing of the kind
        aQuietProcess();
        const surface = surfaceOf(['Something else']);

        // Then - the failure is the caller's, not the window's
        const widened = await widenedForWindow(
            { kind: 'button', name: 'Experiments' },
            'http://localhost/',
            surface,
        );
        expect(widened).toBeUndefined();
    });

    test('says nothing when the substring designates SEVERAL', async () => {
        // Given - a name two elements carry in part, which is the ambiguity the old default hid
        aQuietProcess();
        const surface = surfaceOf(['Read Articles', 'Articles archive']);

        // Then - the window does not guess which one the author meant (W3)
        const widened = await widenedForWindow(
            { kind: 'link', name: 'Articles' },
            'http://localhost/',
            surface,
        );
        expect(widened).toBeUndefined();
    });

    test('says nothing when the whole name ARRIVES while the surface settles', async () => {
        // Given - the page being LEFT, carrying the destination's heading only as a substring
        const lines = aQuietProcess();
        const leaving = surfaceOf(['All articles, in one place']);
        const navigating: WindowProbe = {
            ...leaving,
            // The destination parses, and the exact name is there after all.
            settles: async () => await Promise.resolve(true),
        };

        // Then - the descriptor is left exactly as written, and no line is printed
        const widened = await widenedForWindow(
            { kind: 'heading', name: 'All articles' },
            'http://localhost/window',
            navigating,
        );
        expect(widened).toBeUndefined();
        expect(lines).toHaveLength(0);
    });

    test('pays the settle budget once per descriptor, not once per verb', async () => {
        // Given - a surface that never settles, and the same descriptor asked twice
        aQuietProcess();
        let asked = 0;
        const surface: WindowProbe = {
            ...surfaceOf(['Experiments 9']),
            settles: async () => {
                asked += 1;
                return await Promise.resolve(false);
            },
        };
        const element: ElementRef = { kind: 'button', name: 'Experiments' };

        // Then - the verdict was made once and reused, so a scenario run ten times waits once
        await widenedForWindow(element, 'http://localhost/', surface);
        await widenedForWindow(element, 'http://localhost/', surface);
        expect(asked).toBe(1);
    });

    test('warns once, naming the spelling to write', async () => {
        // Given - the same descriptor asked for twice, as a scenario run twice would
        const lines = aQuietProcess();
        const surface = surfaceOf(['Experiments 9']);
        const element: ElementRef = { kind: 'button', name: 'Experiments' };

        // Then - one line, carrying the name the author should be writing
        await widenedForWindow(element, 'http://localhost/', surface);
        await widenedForWindow(element, 'http://localhost/', surface);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("The name to write is 'Experiments 9'");
    });
});
