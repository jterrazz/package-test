/** How a fixture is laid into the working directory — the only way `.fixture()` reaches the disk. */
export type FixturePort = {
    /**
     * Copy what `path` names, relative to `testDir`, into `workDir`: a
     * directory's contents spread into it, a file under its own name.
     * Refuses a path that names nothing, or the other kind than it says.
     */
    readonly layer: (path: string, testDir: string, workDir: string) => void;
};
