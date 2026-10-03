import { file } from '../../disk/spec-path.js';
import {
    GOLDEN_MATCHER,
    matchThroughGolden,
    streamValueRoute,
    WHOLE_MATCHER,
} from './text-assertions.js';

type Overwrite = (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown;

/** A chai whose matchers record what they are handed; `overrides` replaces any of them. */
export function chaiWith(
    answered: string[],
    subject?: unknown,
    overrides: Record<string, unknown> = {},
): {
    Assertion: { prototype: Record<string, unknown> };
    util: {
        flag: (assertion: object, key: 'object') => unknown;
        overwriteMethod: (target: object, name: string, method: Overwrite) => void;
    };
} {
    const prototype: Record<string, unknown> = {
        [GOLDEN_MATCHER]: () => answered.push('golden'),
        [WHOLE_MATCHER]: (_value: unknown, call: { stack?: unknown }) =>
            answered.push(
                typeof call.stack === 'string' && call.stack.includes('toMatch call site')
                    ? 'whole'
                    : 'no site',
            ),
        toMatch: () => answered.push('vitest'),
        ...overrides,
    };
    return {
        Assertion: { prototype },
        util: {
            flag: () => subject,
            overwriteMethod: (target, name, method) => {
                const original: unknown = Reflect.get(target, name);
                if (typeof original === 'function') {
                    Reflect.set(
                        target,
                        name,
                        method(function overwritten(this: unknown, ...args: unknown[]): unknown {
                            return Reflect.apply(original, this, args);
                        }),
                    );
                }
            },
        },
    };
}

export function toMatchOf(chai: ReturnType<typeof chaiWith>): (...args: unknown[]) => unknown {
    const { prototype } = chai.Assertion;
    return (...args) => {
        const toMatch: unknown = prototype.toMatch;
        const answer: unknown =
            typeof toMatch === 'function' ? Reflect.apply(toMatch, prototype, args) : undefined;
        return answer;
    };
}

const OWN_DIRECTORY = new URL('.', import.meta.url).pathname.replace(/\/$/u, '');

/** A failure whose stack holds a frame of the router's own directory, then the test's. */
export function routerFailure(): Error {
    const error = new Error('mismatch');
    error.stack = `Error: mismatch\n    at ${OWN_DIRECTORY}/router.js:1:1\n    at /repo/specs/a.spec.ts:2:2`;
    return error;
}

export function stacklessError(): Error {
    const error = new Error('bare');
    delete error.stack;
    return error;
}

/** What a test reads of a golden's failure once it went through the router: a stack, a message, or the value thrown. */
export async function thrownThrough(golden: () => unknown): Promise<unknown> {
    const chai = chaiWith([], undefined, { [GOLDEN_MATCHER]: golden });
    matchThroughGolden(chai, streamValueRoute);
    try {
        // checker-disable-next-line named-path-exists -- the routing under test hands the path to a recorder: nothing reads the disk
        await toMatchOf(chai)(file('./_expected/out.txt'));
        return 'passed';
    } catch (error) {
        return error instanceof Error ? (error.stack ?? error.message) : error;
    }
}
