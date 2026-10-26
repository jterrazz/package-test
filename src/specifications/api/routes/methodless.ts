import type { Lesson } from '../../../chain/refusals/refusal.js';
import type { Route } from './routes.js';

function shapeOf(path: string): string {
    return path.replaceAll(/:[^/]+/gu, ':');
}

export function methodlessDrift(table: readonly Route[], methodless: readonly string[]): string[] {
    const named = new Set(methodless.map((path) => shapeOf(path)));
    const any = [
        ...new Map(
            table
                .filter((route) => route.method === 'ALL')
                .map((route) => [shapeOf(route.path), route.path]),
        ),
    ];
    const taken = new Set(any.map(([shape]) => shape));
    const missed = any
        .filter(([shape]) => !named.has(shape))
        .map(
            ([, path]) =>
                `  ALL ${path}: the app takes it on any method, and the list misses it, so add '${path}' with why the app takes it on any method`,
        );
    const stale = methodless
        .filter((path) => !taken.has(shapeOf(path)))
        .map((path) =>
            table.some((route) => shapeOf(route.path) === shapeOf(path))
                ? `  ${path}: the list names it, and the app takes it on its own methods only, so remove '${path}'`
                : `  ${path}: the list names it, and the app's table holds no such route, so remove '${path}'`,
        );
    return [...missed, ...stale];
}

export function methodlessDrifted(drift: string[]): Lesson {
    return {
        fix: 'state in `test: { methodless }` exactly the routes the app takes on any method, each with its reason',
        found: `api routes: \`test: { methodless }\` in studio.config.ts drifted from the app's table:\n${drift.join('\n')}`,
        read: 'docs/guides/api-specs.md#a-route-taken-on-any-method',
        why: '`test: { methodless }` names the routes the app takes on any method, which the checker files by their path, whatever verb a spec sends.',
    };
}
