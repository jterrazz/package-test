export type LinkPort = {
    readonly link: (name: string, path: null | string, testDir: string, workDir: string) => void;
    /** Lays the tarball `npm pack` writes for the package at `path` (the spec's own project when `null`), as a consumer's install lays it. */
    readonly packed: (name: string, path: null | string, testDir: string, workDir: string) => void;
};
