export type ChainConfig = {
    root?: string | undefined;
};

export type Started<Config extends ChainConfig, Key extends keyof Config> = Config & {
    readonly [Name in Key]-?: NonNullable<Config[Name]>;
};
