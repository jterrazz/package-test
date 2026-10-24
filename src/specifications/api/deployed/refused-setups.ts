import { refusal } from '../../../chain/refusals/refusal.js';

// invariant: what an app built in this process offers and a deployed one cannot: its database, its outbound network, its clock, and the verbs a deployed chain leaves to `.request()`.
const IN_PROCESS_ONLY = new Set(['clock', 'delete', 'intercept', 'post', 'put', 'seed']);

function refusedSetup(name: string): Error {
    return new Error(
        refusal({
            fix: 'seed, stub and pin the app with `server`, in this process; against a `url`, send the request (`.get()`, `.request()`) and compare the response',
            found: `.${name}() on the chain of specification.api({ url })`,
            read: 'docs/guides/api-specs.md#deployed-target-url',
            why: 'A deployed api runs elsewhere: its database, its outbound network and its clock are its own, so its chain offers what a request can do, and a request other than a GET is written whole.',
        }),
    );
}

/** The type already holds it; an untyped caller is told why rather than that the method is undefined. */
export function refusingInProcessSetups<Chain extends object>(chain: Chain): Chain {
    return new Proxy(chain, {
        get: (target, name, receiver) => {
            if (typeof name === 'string' && IN_PROCESS_ONLY.has(name)) {
                return () => {
                    throw refusedSetup(name);
                };
            }
            const value: unknown = Reflect.get(target, name, receiver);
            if (typeof value !== 'function') {
                return value;
            }
            // invariant: a setup hands back the next chain, which refuses the same; an action hands back a promise, kept as it is.
            return (...args: unknown[]) => {
                const next: unknown = Reflect.apply(value, target, args);
                return next !== null && typeof next === 'object' && !(next instanceof Promise)
                    ? refusingInProcessSetups(next)
                    : next;
            };
        },
    });
}
