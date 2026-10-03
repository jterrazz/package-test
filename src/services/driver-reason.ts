/** What a database driver says went wrong: its message, else its code — a refused connection is an `AggregateError` with an empty message and `ECONNREFUSED`. */
export function driverReason(error: unknown): string {
    if (error instanceof Error && error.message !== '') {
        return error.message;
    }
    const code: unknown =
        typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    return typeof code === 'string' && code !== '' ? code : String(error);
}
