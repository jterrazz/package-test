export class CheckerStopError extends Error {
    readonly code: number;

    constructor(code: number) {
        super(`the run stopped with ${code}`);
        this.name = 'CheckerStopError';
        this.code = code;
    }
}

export function stop(code: number): never {
    throw new CheckerStopError(code);
}

export function exitCodeOf(program: () => void): number {
    try {
        program();
        return 0;
    } catch (error) {
        if (error instanceof CheckerStopError) {
            return error.code;
        }
        throw error;
    }
}
