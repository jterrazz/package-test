/** What a database driver says went wrong: its message, else its code — a refused connection is an `AggregateError` with an empty message and `ECONNREFUSED`. */
export function driverReason(error: unknown): string {
    if (error instanceof Error && error.message !== '') {
        return error.message;
    }
    const code: unknown = Reflect.get(new Object(error), 'code');
    return typeof code === 'string' && code !== '' ? code : String(error);
}
