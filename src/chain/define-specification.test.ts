import { describe, expect, test } from 'vitest';

import { defineAction } from './action.js';
import { defineCapability } from './capability.js';
import { sharing } from './context/with.capability.js';
import { defineSpecification } from './define-specification.js';

/** A setup that logs its slice when it is armed, in the phase it states. */
function logged(
    log: string[],
    name: 'clock' | 'env' | 'plain',
    phase: number,
    context?: 'clock' | 'env',
) {
    return defineCapability<
        typeof name,
        string,
        [value: string],
        never,
        Record<never, never>,
        'clock' | 'env'
    >({
        ...(context === undefined ? {} : { context }),
        arm: (slice) => {
            log.push(`${name}=${slice}`);
            return {};
        },
        initial: '-',
        name,
        phase,
        reduce: (_slice, [value]) => value,
        row: { group: 'Setup', name: `.${name}()`, probe: `.${name}(` },
    });
}

type Chain = {
    act: () => Promise<string>;
    clock: (value: string) => Chain;
    env: (value: string) => Chain;
    plain: (value: string) => Chain;
    with: (context: { clock?: string; env?: string }) => Chain;
};

function specificationOver(log: string[]): Chain {
    const definition = defineSpecification<Chain>()({
        actions: [
            defineAction<'act', [], string>({
                accessors: [],
                name: 'act',
                perform: async () => await Promise.resolve('done'),
                row: { group: 'Terminal action', name: '.act()', probe: '.act(' },
            }),
        ],
        adapters: () => ({}),
        capabilities: [
            logged(log, 'plain', 2),
            sharing,
            logged(log, 'env', 1, 'env'),
            logged(log, 'clock', 0, 'clock'),
        ],
        locate: () => '/spec/dir',
        options: {},
    });
    return definition.open({});
}

describe('defineSpecification', () => {
    test('a chain — arms its setups in phase order with the slices its calls gave, the shared settings applied to the setups they name', async () => {
        // Given - a chain sharing a setting for one setup, none for another, and a call on a third
        const log: string[] = [];
        const result = await specificationOver(log).with({ env: 'shared' }).plain('called').act();

        // Then - the action's value, and each setup armed in its phase, the unnamed one at its initial slice
        expect([result, log]).toStrictEqual(['done', ['clock=-', 'env=shared', 'plain=called']]);
    });

    test('a chain — a setting shared for no setup is ignored, and a call after the shared one wins', async () => {
        // Given - a shared setting for the clock, overridden by a call, and nothing shared for the env
        const log: string[] = [];
        await specificationOver(log).with({ clock: 'shared' }).clock('called').act();

        // Then - the call's slice, and the env left as it was
        expect(log).toStrictEqual(['clock=called', 'env=-', 'plain=-']);
    });
});
