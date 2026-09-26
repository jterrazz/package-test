import { refusal } from '../catalogue/refusal.js';

export function isRelativePath(value: string): boolean {
    return value.startsWith('./') || value.startsWith('../');
}

function asRelative(path: unknown): string {
    const bare = typeof path === 'string' ? path.replace(/^\/+/u, '') : '';
    return `./${bare === '' ? 'expected/output.txt' : bare}`;
}

export function requireRelativePath(call: string, path: unknown): asserts path is string {
    if (typeof path !== 'string' || !isRelativePath(path)) {
        throw new TypeError(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `start it with ./ or ../, from the spec file: ${call}('${asRelative(path)}')`,
                found: `${call}(${JSON.stringify(path)}), a path that is not relative to the spec file`,
            }),
        );
    }
}
