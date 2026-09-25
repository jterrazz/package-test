export const GROUND_EXPECTED = 'expected';
export const GROUND_FIXTURES = 'fixtures';
export const GROUND_REQUESTS = 'requests';
export const GROUND_SEEDS = 'seeds';

export const GROUND_DIRS = [
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
] as const;

export const GROUND_GLOB = `**/{${GROUND_DIRS.join(',')}}/**`;

/** Reserved directly under the specs root only; deeper the name is free. */
export const SHARED_GROUND = 'shared';

export function isGroundName(name: string): boolean {
    return (GROUND_DIRS as readonly string[]).includes(name);
}

export const RENAMED_GROUND_DIRS: Readonly<Record<string, string>> = {
    _expected: GROUND_EXPECTED,
    _fixtures: GROUND_FIXTURES,
    _requests: GROUND_REQUESTS,
    _seeds: GROUND_SEEDS,
};
