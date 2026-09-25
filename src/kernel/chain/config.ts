/**
 * What every constructor hands its chain, whatever the facet: where the
 * project's paths start. A facet's configuration EXTENDS it with the fields
 * its engines need, each declared by its owner — the services record by
 * `world/services/`, the stub backend by `world/stubs/`, the rest by the
 * facet whose constructor starts it — so the kernel knows no facet's.
 */
export type ChainConfig = {
    /** The project root — the working directory a document's `serve:` command runs from. */
    root?: string | undefined;
};

/**
 * A configuration whose constructor started the named engines — each of them
 * present, so a facet armed through them is handed them by type.
 */
export type Started<Config extends ChainConfig, Key extends keyof Config> = Config & {
    readonly [Engine in Key]-?: NonNullable<Config[Engine]>;
};
