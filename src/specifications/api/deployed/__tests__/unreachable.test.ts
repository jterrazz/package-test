import { describe, expect, test } from 'vitest';

import { codeOf, refusedCertificate, unreachableReason } from '../unreachable.js';

const raised = (code: string): Error => Object.assign(new Error(`raised ${code}`), { code });

describe('unreachable', () => {
    test('unreachableReason — why an exchange never answered — each network failure reads as its flavour, by the code node raised', () => {
        // Given - the codes a resolver, a refused port, a reset and an unroutable address raise
        const codes = [
            'ENOTFOUND',
            'EAI_AGAIN',
            'EAI_FAIL',
            'EAI_NODATA',
            'EAI_NONAME',
            'ENODATA',
            'ECONNREFUSED',
            'ECONNRESET',
            'ECONNABORTED',
            'EPIPE',
            'EHOSTUNREACH',
            'EHOSTDOWN',
            'ENETUNREACH',
            'ENETDOWN',
        ];

        // Then - the flavour each one reads as
        expect(codes.map((code) => unreachableReason(raised(code)))).toStrictEqual([
            'dns',
            'dns',
            'dns',
            'dns',
            'dns',
            'dns',
            'refused',
            'reset',
            'reset',
            'reset',
            'no route',
            'no route',
            'no route',
            'no route',
        ]);
    });

    test("unreachableReason — why an exchange never answered — a handshake's own failure is tls and its code, its network's stays the network's, and anything else is its code or its message", () => {
        // Given - failures during a handshake and outside one
        const reasons = [
            unreachableReason(raised('ERR_SSL_WRONG_VERSION_NUMBER'), true),
            unreachableReason(new Error('no code'), true),
            unreachableReason(raised('ECONNRESET'), true),
            unreachableReason(raised('ERR_STREAM_PREMATURE_CLOSE')),
            unreachableReason(new Error('socket hang up')),
            unreachableReason('a thrown string'),
            unreachableReason(42),
        ];

        // Then - each as the golden reads it
        expect(reasons).toStrictEqual([
            'tls ERR_SSL_WRONG_VERSION_NUMBER',
            'tls handshake',
            'reset',
            'ERR_STREAM_PREMATURE_CLOSE',
            'socket hang up',
            'a thrown string',
            '42',
        ]);
    });

    test('codeOf and refusedCertificate — the code a failure carries — a string is its own code, an empty one none, and a refused certificate is tls and its code', () => {
        // Given - codes carried every way node carries them
        const codes = [
            codeOf('CERT_HAS_EXPIRED'),
            codeOf(''),
            codeOf(raised('ECONNREFUSED')),
            codeOf(raised('')),
            codeOf(Object.assign(new Error('numeric'), { code: 7 })),
            codeOf(null),
        ];

        // Then - the code each one names, and the reason a refused certificate reads as
        expect([codes, refusedCertificate('CERT_HAS_EXPIRED')]).toStrictEqual([
            ['CERT_HAS_EXPIRED', undefined, 'ECONNREFUSED', undefined, undefined, undefined],
            'tls CERT_HAS_EXPIRED',
        ]);
    });
});
