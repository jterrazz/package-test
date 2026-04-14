/**
 * Strategy for isolating service state across parallel test workers.
 *
 * Each service handle provides an isolation strategy. The framework
 * calls `acquire()` once per vitest worker, `reset()` before each
 * `spec.run()`, and `release()` when the worker shuts down.
 *
 * Implement this interface to support new service types (e.g. MongoDB,
 * Elasticsearch, S3).
 */
export interface IsolationStrategy {
    /**
     * Create an isolated namespace for this worker.
     * Called once when the worker starts — e.g. clone a template database,
     * set a Redis key prefix.
     *
     * @param workerId - Unique identifier for this vitest worker.
     */
    acquire(workerId: string): Promise<void>;

    /**
     * Fast reset within the namespace between `spec.run()` calls.
     * E.g. truncate tables (without dropping the database).
     */
    reset(): Promise<void>;

    /**
     * Tear down the isolated namespace.
     * Called once when the worker shuts down — e.g. drop the cloned database.
     */
    release(): Promise<void>;
}
