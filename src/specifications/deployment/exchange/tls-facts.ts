import { checkServerIdentity } from 'node:tls';
import type { PeerCertificate } from 'node:tls';

const DAY_MS = 86_400_000;

/** The certificate an HTTPS exchange was presented, and what the client made of it. */
export type TlsFacts = {
    /** The names the certificate is valid for (its subjectAltName), each without its `DNS:` or `IP Address:` prefix. */
    readonly altNames: readonly string[];
    /** The code the trust check refused with (`DEPTH_ZERO_SELF_SIGNED_CERT`, `CERT_HAS_EXPIRED`, `ERR_TLS_CERT_ALTNAME_INVALID` ...), undefined when trusted. */
    readonly authorizationError: string | undefined;
    /** Whether the certificate chains to a trusted authority and covers the URL's host. */
    readonly authorized: boolean;
    /** Whole days from the exchange to `validTo`, negative once it has expired. */
    readonly daysRemaining: number;
    /** The issuer's common name, or its organisation when it states none. */
    readonly issuer: string;
    /** The TLS version negotiated (`TLSv1.3`). */
    readonly protocol: string | undefined;
    /** The subject's common name; empty when it states none. */
    readonly subject: string;
    readonly validFrom: Date;
    readonly validTo: Date;
    /** Whether the certificate is valid for `host`, wildcards read as a client reads them. */
    covers: (host: string) => boolean;
};

function firstOf(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function altNamesOf(certificate: PeerCertificate): string[] {
    return (
        (certificate.subjectaltname ?? '')
            .split(',')
            // invariant: each name opens on its kind and a colon (`DNS:`, `IP Address:`); an IPv6 address holds colons of its own after it.
            .map((name) => name.trim().slice(name.trim().indexOf(':') + 1))
            .filter((name) => name !== '')
    );
}

/** Read at the moment of the exchange, so `daysRemaining` is the margin the deployment had when it answered. */
export function tlsFacts(
    certificate: PeerCertificate,
    verdict: { authorizationError: string | undefined; protocol: string | undefined },
    now: number,
): TlsFacts {
    const validTo = new Date(certificate.valid_to);
    return {
        altNames: altNamesOf(certificate),
        authorizationError: verdict.authorizationError,
        authorized: verdict.authorizationError === undefined,
        covers: (host) => checkServerIdentity(host, certificate) === undefined,
        daysRemaining: Math.floor((validTo.getTime() - now) / DAY_MS),
        issuer: firstOf(certificate.issuer.CN) ?? firstOf(certificate.issuer.O) ?? '',
        protocol: verdict.protocol,
        subject: firstOf(certificate.subject.CN) ?? '',
        validFrom: new Date(certificate.valid_from),
        validTo,
    };
}
