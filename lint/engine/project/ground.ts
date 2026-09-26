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

export const SHARED_FOLDER = '_shared';

export const SETUP_FOLDER = '_setup';

export const RESERVED_FOLDERS = [SETUP_FOLDER, ...GROUND_DIRS, SHARED_FOLDER] as const;

export const UNMARKED_RESERVED: Readonly<Record<string, string>> = {
    doubles: SETUP_FOLDER,
    expected: GROUND_EXPECTED,
    fixtures: GROUND_FIXTURES,
    requests: GROUND_REQUESTS,
    seeds: GROUND_SEEDS,
    setup: SETUP_FOLDER,
    shared: SHARED_FOLDER,
};

export function isGroundName(name: string): boolean {
    return (GROUND_DIRS as readonly string[]).includes(name);
}

export function isReservedName(name: string): boolean {
    return (RESERVED_FOLDERS as readonly string[]).includes(name);
}
