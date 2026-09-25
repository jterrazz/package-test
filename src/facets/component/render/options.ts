import type { UserConfig, UserConfigFn } from 'vite';

/**
 * What `component()` states for every render of its project — the facet's
 * own constructor options, beside the ones every project shares.
 */
export type ComponentOptions = {
    /** Freeze the page's `Date` for every render of the project. */
    clock?: string;
    /** `Accept-Language` and `Intl` locale of the page. Default `'en-US'`. */
    locale?: string;
    /**
     * The directory `vite` and `wrap` are resolved against. Default: the
     * directory of the file that CALLED the helper (`callerDirectory` in
     * `component.project.ts`). State it when the call is not written in the
     * config it configures (a shared config factory).
     */
    root?: string;
    /** IANA zone the page's `Date` reports in. Default `'UTC'`. */
    timezone?: string;
    /**
     * The app's own Vite pipeline: a config path, the object, or the function
     * a framework exports. Only the PIPELINE is adopted (`reroot` in `component.project.ts`).
     */
    vite?: Promise<UserConfig> | string | UserConfig | UserConfigFn;
    /** The page size every render gets. Default 1280×720. */
    viewport?: { height: number; width: number };
    /**
     * A module whose default export is `(ui) => ReactNode` — the providers
     * every render of this project is dressed in (a theme, a store, an intl
     * provider). A router belongs on the chain instead: it is a test's Given.
     */
    wrap?: string;
};
