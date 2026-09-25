export type ChainConfig = {
    root?: string | undefined;
};

export type Started<Config extends ChainConfig, Key extends keyof Config> = Config & {
    readonly [Engine in Key]-?: NonNullable<Config[Engine]>;
};
