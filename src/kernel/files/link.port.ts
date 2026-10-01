export type LinkPort = {
    readonly link: (name: string, path: null | string, testDir: string, workDir: string) => void;
};
