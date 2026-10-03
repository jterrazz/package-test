/** Receives the working directory's absolute path. */
export type PrepareStep = (workdir: string) => Promise<void> | void;

export type PreparePort = {
    readonly run: (steps: readonly PrepareStep[], workDir: string) => Promise<void>;
};
