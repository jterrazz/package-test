import { describe, expect, test } from 'vitest';

import { defineAction } from './action.js';
import type { AnyAction } from './action.js';
import { defineCapability } from './capability.js';
import type { AnyCapability, Armed } from './capability.js';
import { perform } from './perform.js';
import { EMPTY_STATE } from './state.js';

/** A setup that logs its arming and its release under `name`, at `phase`. */
function logged(
    log: string[],
    name: string,
    phase: number,
    effect: Omit<Armed, 'release'> = {},
): AnyCapability {
    return defineCapability({
        arm: () => {
            log.push(`arm ${name}`);
            return {
                ...effect,
                release: () => {
                    log.push(`release ${name}`);
                },
            };
        },
        initial: null,
        name,
        phase,
        reduce: (slice) => slice,
        row: { group: 'Setup', name: `.${name}()`, probe: `.${name}(` },
    });
}

/** An action that logs itself, then hands back `outcome` — or throws it, when it is an error. */
function acting(log: string[], outcome: unknown): AnyAction {
    return defineAction({
        accessors: [],
        name: 'act',
        perform: async () => {
            log.push('act');
            if (outcome instanceof Error) {
                throw outcome;
            }
            return await Promise.resolve(outcome);
        },
        row: { group: 'Terminal action', name: '.act()', probe: '.act(' },
    });
}

/** What the pipeline is handed beside the action: no config, no engines, nothing told. */
const WHERE = { config: {}, engines: {}, state: EMPTY_STATE, testDir: '/specs' };

describe('perform — the one pipeline a terminal action runs through', () => {
    test('arms every setup in phase order, runs the action, and releases in reverse', async () => {
        // Given - three setups listed out of phase order
        const log: string[] = [];
        const setups = [
            logged(log, 'clock', 50),
            logged(log, 'seed', 10),
            logged(log, 'intercept', 40),
        ];

        // When - an action closes the chain
        const value = await perform(setups, acting(log, 'done'), [], WHERE);

        // Then - the seed lands first, the clock last, and each effect is undone in reverse
        expect({ log, value }).toStrictEqual({
            log: [
                'arm seed',
                'arm intercept',
                'arm clock',
                'act',
                'release clock',
                'release intercept',
                'release seed',
            ],
            value: 'done',
        });
    });

    test("an engine's violation is the failure reported, over the error the action met", async () => {
        // Given - an engine that recorded an unmatched request, and an action that failed on the reply it got
        const log: string[] = [];
        const unmatched = new Error('no contract accepted GET https://api.test/rates');
        const setups = [logged(log, 'intercept', 40, { violation: () => unmatched })];

        const failing = acting(log, new Error('rates were undefined'));

        // Then - the violation is what the test reads, and the effect is still released
        await expect(perform(setups, failing, [], WHERE)).rejects.toBe(unmatched);
        expect(log).toStrictEqual(['arm intercept', 'act', 'release intercept']);
    });

    test("an engine's violation fails an action that succeeded", async () => {
        // Given - an engine that recorded an unmatched request the subject swallowed
        const log: string[] = [];
        const unmatched = new Error('no contract accepted GET https://api.test/rates');
        const setups = [logged(log, 'intercept', 40, { violation: () => unmatched })];

        // Then - the action's success does not hide it
        await expect(perform(setups, acting(log, 'ok'), [], WHERE)).rejects.toBe(unmatched);
    });

    test('a setup that refuses when armed still releases what was armed before it', async () => {
        // Given - contracts armed, then a clock whose instant is refused when it is pinned
        const log: string[] = [];
        const refused = new TypeError('"soon" is not an instant');
        const clock = defineCapability({
            arm: () => {
                throw refused;
            },
            initial: null,
            name: 'clock',
            phase: 50,
            reduce: (slice) => slice,
            row: { group: 'Setup', name: '.clock()', probe: '.clock(' },
        });

        // Then - the refusal is reported, the action never runs, and the contracts are taken down
        await expect(
            perform([logged(log, 'intercept', 40), clock], acting(log, 'ok'), [], WHERE),
        ).rejects.toBe(refused);
        expect(log).toStrictEqual(['arm intercept', 'release intercept']);
    });

    test('an action takes down what it left standing before any setup is armed', async () => {
        // Given - an action whose preparation waits on a teardown before it settles
        const log: string[] = [];
        const replacing: AnyAction = {
            ...acting(log, 'done'),
            prepare: async () => {
                await Promise.resolve();
                log.push('take down');
                return { workDir: null };
            },
        };

        // When - it closes a chain with contracts to arm
        await perform([logged(log, 'intercept', 40)], replacing, [], WHERE);

        // Then - the teardown is over before the contracts are armed
        expect(log).toStrictEqual(['take down', 'arm intercept', 'act', 'release intercept']);
    });
});
