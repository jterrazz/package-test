/** Isolates service state across parallel workers: `acquire()` per worker, `reset()` per run, `release()` at shutdown. */
export type IsolationStrategy = {
    /** Create this worker's isolated namespace, once at worker start. */
    acquire: (workerId: string) => Promise<void>;

    /** Fast reset within the namespace between runs. */
    reset: () => Promise<void>;

    /** Tear down the namespace, once at worker shutdown. */
    release: () => Promise<void>;
};
