import { defineCapability } from '../../model/chain/capability.js';
import type { ClockPort } from './clock.port.js';

/** `.clock(iso)`, handing back the chain it was called on. */
export type ClockMethod<Self> = (iso: string) => Self;

/**
 * `.clock(iso)`: the instant the subject's calendar reads for this chain. The
 * instant is taken as written and judged when the chain is armed, by the
 * engine that pins it — released when the action settles, so a chain never
 * leaks its instant into the next one (CONVENTIONS D16). A chain that states
 * none hands the engine `null`: the engine pins the default its subject has,
 * or nothing.
 */
export const clock = defineCapability<
    'clock',
    null | string,
    [iso: string],
    { clock: ClockPort },
    'clock'
>({
    arm: (instant, engines) => engines.clock.pin(instant),
    context: 'clock',
    initial: null,
    name: 'clock',
    phase: 50,
    reduce: (_pinned, [iso]) => iso,
    row: { group: 'Setup', name: '.clock()', probe: '.clock(' },
});
