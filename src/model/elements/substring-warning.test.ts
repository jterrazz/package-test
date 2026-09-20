import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import type { ElementRef } from '../ports/browser.port.js';
import {
    resetSubstringWarnings,
    throughWindow,
    warnSubstringOnly,
    widenedForWindow,
} from './substring-warning.js';
import type { WindowProbe } from './substring-warning.js';

describe('the transitional warning for a name that only matched in part', () => {
    beforeEach(() => {
        resetSubstringWarnings();
    });

    test('names the descriptor, the spelling to write, the fixes and the deadline', () => {
        // Given - a descriptor that designated nothing as a whole name, and the name that carries it
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        warnSubstringOnly(
            { kind: 'link', name: 'Articles' },
            'http://localhost/ambiguous',
            'Read  Articles ',
        );

        // Then - the reader has the descriptor, the exact name to write, all three ways out, and the release it disappears in
        const [line] = warn.mock.calls.map(([first]) => String(first));
        expect(line).toContain(`link('Articles')`);
        expect(line).toContain('matched only as a SUBSTRING');
        expect(line).toContain(`The name to write is 'Read Articles'.`);
        expect(line).toContain('{ exact: false }');
        expect(line).toContain('through 16.x; gone in 17.0');
        expect(line).toContain('http://localhost/ambiguous');
    });

    test('says it once per descriptor — a scenario run ten times has one thing to fix', () => {
        // Given - the same descriptor reported three times
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const element = { kind: 'link' as const, name: 'Articles' };

        // Then - only the first one prints
        expect(warnSubstringOnly(element, 'a')).toBe(true);
        expect(warnSubstringOnly(element, 'a')).toBe(false);
        expect(warnSubstringOnly(element, 'b')).toBe(false);
    });

    test('tells two descriptors apart by their scope chain, not just their name', () => {
        // Given - the same name, one of them scoped to a landmark
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const bare = { kind: 'link' as const, name: 'Articles' };
        const scoped = { ...bare, scope: { kind: 'navigation' as const } };

        // Then - each is its own thing to fix, so each is reported
        expect(warnSubstringOnly(bare, 'a')).toBe(true);
        expect(warnSubstringOnly(scoped, 'a')).toBe(true);
    });
});

/** A surface where `names` are the whole accessible names on screen. */
function surfaceOf(names: string[]): WindowProbe {
    const matching = (element: ElementRef): string[] =>
        names.filter((name) =>
            element.exact === false ? name.includes(element.name ?? '') : name === element.name,
        );
    return {
        count: async (element) => await Promise.resolve(matching(element).length),
        nameOf: async (element) => await Promise.resolve(matching(element)[0]),
    };
}

/** An action that answers the widened descriptor and refuses the whole-name one. */
async function clickTheWidened(element: ElementRef): Promise<string> {
    return element.exact === false
        ? await Promise.resolve('clicked')
        : await Promise.reject(new Error('not found'));
}

/** A silent console, and no descriptor remembered from an earlier case. */
function aQuietProcess(): MockInstance<typeof console.warn> {
    resetSubstringWarnings();
    return vi.spyOn(console, 'warn').mockImplementation(() => {});
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

    test('retries the action once with the widened descriptor', async () => {
        // Given - an action that answers only the substring match
        const warn = aQuietProcess();
        const surface = surfaceOf(['Experiments 9']);

        // Then - the window resolves it, and the warning names the spelling to write
        const answer = await throughWindow({
            element: { kind: 'button', name: 'Experiments' },
            failure: new Error('not found'),
            probe: surface,
            run: clickTheWidened,
            where: 'http://localhost/',
        });
        expect(answer).toBe('clicked');
        expect(String(warn.mock.calls[0]?.[0])).toContain("The name to write is 'Experiments 9'");
    });

    test('hands back the original failure when the retry answers nothing either', async () => {
        // Given - a widened descriptor whose action fails all the same
        aQuietProcess();
        const surface = surfaceOf(['Experiments 9']);
        const failure = new Error('the failure the caller already had');

        // Then - the caller is never handed an error about a descriptor nobody wrote
        await expect(
            throughWindow({
                element: { kind: 'button', name: 'Experiments' },
                failure,
                probe: surface,
                run: async () => await Promise.reject(new Error('about the widened one')),
                where: 'http://localhost/',
            }),
        ).rejects.toBe(failure);
    });
});
