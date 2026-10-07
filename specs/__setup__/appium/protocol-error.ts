export class ProtocolError extends Error {
    override readonly name = 'ProtocolError';

    readonly code: string;

    readonly status: number;

    constructor(code: string, status: number, message: string) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
