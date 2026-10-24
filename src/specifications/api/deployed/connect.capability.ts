import { defineCapability } from '../../../chain/capability.js';
import type { ChainSignature } from '../../../chain/capability.js';

export type ConnectChain<Self> = {
    /** Open the socket on this address instead of the URL's host and port, as curl's `--connect-to`: the Host header and the TLS server name stay the URL's; a later call wins. */
    connect: (address: string) => Self;
};

export interface ConnectSignature extends ChainSignature {
    readonly chain: ConnectChain<this['self']>;
}

/** Read by the exchange, never armed: the address is where one request is sent, not a state of the world. */
export const connect = defineCapability<
    'connect',
    null | string,
    [address: string],
    ConnectSignature
>({
    initial: null,
    name: 'connect',
    phase: 0,
    reduce: (_held, [address]) => address,
    row: { group: 'Setup', name: '.connect()', probe: '.connect(' },
});
