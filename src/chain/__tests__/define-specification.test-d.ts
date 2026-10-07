import type { Action } from '../action.js';
import type { Capability } from '../capability.js';
import type { ChainConfig, Started } from '../config.js';
import { defineSpecification } from '../define-specification.js';

declare const note: Capability<'note', readonly string[], [text: string]>;
declare const read: Action<'read', [], readonly string[]>;

const composition = { actions: [read], capabilities: [note], options: {} } as const;
const wiring = { adapters: () => ({}), locate: () => '/specs' };

type Noted = { note: (text: string) => Noted; read: () => Promise<readonly string[]> };

export const matching = defineSpecification<Noted>()({ ...composition, ...wiring });

export const forgetful = defineSpecification<Omit<Noted, 'note'>>()(
    // @ts-expect-error the composition lists `note`, the chain type does not [`composedButNotOnTheChain`]
    { ...composition, ...wiring },
);

export const inventive = defineSpecification<Noted & { label: () => Noted }>()(
    // @ts-expect-error the chain type names `label`, the composition does not [`onTheChainButNotComposed`]
    { ...composition, ...wiring },
);

type Served = ChainConfig & { server?: undefined | { readonly url: string } };

const served = defineSpecification<Noted, Started<Served, 'server'>>()({
    ...composition,
    adapters: (config: Started<Served, 'server'>) => ({ server: config.server }),
    locate: () => '/specs',
});

declare const server: { readonly url: string };

export const openedOnItsServer = served.open({ server });

// @ts-expect-error the specification is armed through a server, and this configuration started none
export const openedWithoutIt = served.open({});
