export type ChainConfig = {
    root?: string | undefined;
};

export type Started<Config extends ChainConfig, Key extends keyof Config> = Config & {
    readonly [Driver in Key]-?: NonNullable<Config[Driver]>;
};
