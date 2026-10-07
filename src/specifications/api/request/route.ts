import type { ActionOption } from '../../../chain/capability.js';
import { refusal } from '../../../chain/refusals/refusal.js';

/** A path with no `:name` segment is sent as written; `{ params: {} }` states that it is the route. */

export const params: ActionOption<'params'> = {
    kind: 'option',
    name: 'params',
    row: { group: 'Route option', member: 'params', name: '{ params }', probe: 'params:' },
};

export type RouteParamNames<Path extends string> = Path extends `${infer Route}?${string}`
    ? RouteParamNames<Route>
    : Path extends `${string}/:${infer Rest}`
      ? Rest extends `${infer Name}/${infer Tail}`
          ? Name | RouteParamNames<`/${Tail}`>
          : Rest
      : never;

export type RouteOptions<Path extends string> = [RouteParamNames<Path>] extends [never]
    ? { params?: Record<never, never> }
    : { params: Record<RouteParamNames<Path>, number | string> };

export type RouteArguments<Path extends string> = [RouteParamNames<Path>] extends [never]
    ? [options?: RouteOptions<Path>]
    : [options: RouteOptions<Path>];

export type RouteOptionsAny = undefined | { params?: Record<string, number | string> };

export type RouteRequest = { path: string; template?: string | undefined };

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u;

// invariant: the name a `:name` segment states, none for any other segment.
function parameterOf(segment: string): string | undefined {
    const name = segment.slice(1);
    return segment.startsWith(':') && IDENTIFIER.test(name) ? name : undefined;
}

function callWith(method: string, template: string, names: readonly string[]): string {
    const values =
        names.length === 0 ? '{}' : `{ ${names.map((name) => `${name}: …`).join(', ')} }`;
    return `.${method.toLowerCase()}(${JSON.stringify(template)}, { params: ${values} })`;
}

/** A parameter with no value, and a value no parameter takes, are refused. */
export function routeRequest(
    method: string,
    template: string,
    options?: RouteOptionsAny,
): RouteRequest {
    const values = options?.params;
    const [route = '', ...query] = template.split('?');
    const names = route
        .split('/')
        .map(parameterOf)
        .filter((name) => name !== undefined);
    if (values === undefined) {
        if (names.length > 0) {
            throw new TypeError(
                refusal('route-written-as-template-at-runtime', {
                    fix: `write ${callWith(method, template, names)}`,
                    found: `.${method.toLowerCase()}(${JSON.stringify(template)}) names ${names.map((name) => `:${name}`).join(', ')} and is handed no params`,
                }),
            );
        }
        return { path: template };
    }
    const missing = names.filter((name) => !Object.hasOwn(values, name));
    const extra = Object.keys(values).filter((name) => !names.includes(name));
    if (missing.length > 0 || extra.length > 0) {
        const told = [
            ...missing.map((name) => `:${name} has no value`),
            ...extra.map((name) => `\`${name}\` is no parameter of it`),
        ].join(', ');
        throw new TypeError(
            refusal('route-written-as-template-at-runtime', {
                fix: `write ${callWith(method, template, names)}`,
                found: `.${method.toLowerCase()}(${JSON.stringify(template)}, { params }): ${told}`,
            }),
        );
    }
    const filled = route
        .split('/')
        .map((segment) => {
            const name = parameterOf(segment);
            return name === undefined ? segment : encodeURIComponent(String(values[name]));
        })
        .join('/');
    return { path: [filled, ...query].join('?'), template };
}
