/** Why an exchange never answered, as the `unreachable: <reason>` line of its golden reads it. */

export const TIMEOUT = 'timeout';

const TLS = 'tls';

// outside: the codes node raises for each way a network refuses, by platform and by resolver.
const REASONS: Readonly<Record<string, string>> = {
    EAI_AGAIN: 'dns',
    EAI_FAIL: 'dns',
    EAI_NODATA: 'dns',
    EAI_NONAME: 'dns',
    ECONNABORTED: 'reset',
    ECONNREFUSED: 'refused',
    ECONNRESET: 'reset',
    EHOSTDOWN: 'no route',
    EHOSTUNREACH: 'no route',
    ENETDOWN: 'no route',
    ENETUNREACH: 'no route',
    ENODATA: 'dns',
    ENOTFOUND: 'dns',
    EPIPE: 'reset',
};

/** The code node raised, when it raised one. */
export function codeOf(error: unknown): string | undefined {
    if (typeof error === 'string') {
        return error === '' ? undefined : error;
    }
    const code: unknown =
        error !== null && typeof error === 'object' ? Reflect.get(error, 'code') : undefined;
    return typeof code === 'string' && code !== '' ? code : undefined;
}

/** `dns`, `refused`, `reset`, `no route`, or the code node raised; a handshake's own failure is `tls <CODE>`, its network's reads as the network's. */
export function unreachableReason(error: unknown, duringHandshake = false): string {
    const code = codeOf(error);
    const reason = code === undefined ? undefined : REASONS[code];
    if (reason !== undefined) {
        return reason;
    }
    if (duringHandshake) {
        return `${TLS} ${code ?? 'handshake'}`;
    }
    return code ?? (error instanceof Error ? error.message : String(error));
}

/** A certificate the trust check refused, by the code it refused with. */
export function refusedCertificate(code: string): string {
    return `${TLS} ${code}`;
}
