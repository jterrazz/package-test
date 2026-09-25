import { refusal } from '../../model/lesson/refusal.js';

/**
 * A request's route, written as the app declares it: the template, with its
 * parameters handed beside it —
 * `api.get('/indicators/:symbol/chart', { params: { symbol: 'btc' } })`.
 *
 * The template is what a reader of the test, the subject reader (C29, C30)
 * and route coverage all read; the path the app is sent is the template
 * filled, each value URI-encoded. A path with no `:name` segment is sent as
 * written, and handing it `{ params: {} }` states that it IS the route.
 */

/** The parameter names a route template holds: `/events/:id/timeline?x=1` → `'id'`. */
export type RouteParamNames<Path extends string> = Path extends `${infer Route}?${string}`
    ? RouteParamNames<Route>
    : Path extends `${string}/:${infer Rest}`
      ? Rest extends `${infer Name}/${infer Tail}`
          ? Name | RouteParamNames<`/${Tail}`>
          : Rest
      : never;

/** What a request to `Path` is handed beside it: the values of its parameters, every one of them. */
export type RouteOptions<Path extends string> = [RouteParamNames<Path>] extends [never]
    ? { params?: Record<never, never> }
    : { params: Record<RouteParamNames<Path>, number | string> };

/** The options argument of a request to `Path`: required exactly when the template holds a parameter. */
export type RouteArguments<Path extends string> = [RouteParamNames<Path>] extends [never]
    ? [options?: RouteOptions<Path>]
    : [options: RouteOptions<Path>];

/** The options as the runtime reads them, whatever the compiler was told. */
export type RouteOptionsAny = undefined | { params?: Record<string, number | string> };

/** A request, as the chain sends it: the path filled, and the template it was written as. */
export type RouteRequest = { path: string; template?: string | undefined };

/** A template segment that is a parameter: `:name`. */
const PARAMETER = /^:(?<name>[A-Za-z_$][\w$]*)$/u;

/** The call a refusal tells the test to write: the template, handed a value per parameter. */
function callWith(method: string, template: string, names: readonly string[]): string {
    const params =
        names.length === 0 ? '{}' : `{ ${names.map((name) => `${name}: …`).join(', ')} }`;
    return `.${method.toLowerCase()}(${JSON.stringify(template)}, { params: ${params} })`;
}

/**
 * The request a chain sends for `template` and its options: the template
 * filled with the params, or the path as written when it is handed none.
 * A parameter with no value, and a value no parameter takes, are refused.
 */
export function routeRequest(
    method: string,
    template: string,
    options?: RouteOptionsAny,
): RouteRequest {
    const params = options?.params;
    const [route = '', ...query] = template.split('?');
    const names = route
        .split('/')
        .map((segment) => PARAMETER.exec(segment)?.groups?.name)
        .filter((name) => name !== undefined);
    if (params === undefined) {
        if (names.length > 0) {
            throw new TypeError(
                refusal('b12-route-params-runtime', {
                    fix: `write ${callWith(method, template, names)}`,
                    found: `.${method.toLowerCase()}(${JSON.stringify(template)}) names ${names.map((name) => `:${name}`).join(', ')} and is handed no params`,
                }),
            );
        }
        return { path: template };
    }
    const missing = names.filter((name) => !Object.hasOwn(params, name));
    const extra = Object.keys(params).filter((name) => !names.includes(name));
    if (missing.length > 0 || extra.length > 0) {
        const told = [
            ...missing.map((name) => `:${name} has no value`),
            ...extra.map((name) => `\`${name}\` is no parameter of it`),
        ].join(', ');
        throw new TypeError(
            refusal('b12-route-params-runtime', {
                fix: `write ${callWith(method, template, names)}`,
                found: `.${method.toLowerCase()}(${JSON.stringify(template)}, { params }): ${told}`,
            }),
        );
    }
    const filled = route
        .split('/')
        .map((segment) => {
            const name = PARAMETER.exec(segment)?.groups?.name;
            return name === undefined ? segment : encodeURIComponent(String(params[name]));
        })
        .join('/');
    return { path: [filled, ...query].join('?'), template };
}
