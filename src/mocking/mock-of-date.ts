import MockDatePackage from 'mockdate';

/** Interface for freezing and resetting the global Date in tests. */
export interface MockDatePort {
    /** Restore the real Date object. */
    reset: () => void;
    /** Freeze `Date.now()` and `new Date()` to the given value. */
    set: (date: Date | number | string) => void;
}

/**
 * Freeze or reset the global Date for deterministic time-dependent tests.
 * Wraps the `mockdate` package.
 */
export const mockOfDate: MockDatePort = MockDatePackage;
