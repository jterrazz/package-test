export type FixturePort = {
    /** Refuses a path naming nothing, or the other kind than it says. */
    readonly layer: (path: string, testDir: string, workDir: string) => void;
};
