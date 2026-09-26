export const GROUND_EXPECTED = '_expected';
export const GROUND_FIXTURES = '_fixtures';
export const GROUND_REQUESTS = '_requests';
export const GROUND_SEEDS = '_seeds';

export const GROUND_DIRS = [
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
] as const;

export const GROUND_GLOB = `**/{${GROUND_DIRS.join(',')}}/**`;

/** Reserved directly under the specs root only; deeper the name is free. */
export const SHARED_GROUND = '_shared';

export function isGroundName(name: string): boolean {
    return (GROUND_DIRS as readonly string[]).includes(name);
}
