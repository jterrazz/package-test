import { blankComments, isFile, readFileCached } from '@jterrazz/typescript/rules';
import { dirname, join, resolve } from 'node:path';

import { isRecord, parsedJson } from './json-shape.js';
import { packageRootOf, projectRootOf } from './role.js';

/** In the order a resolver tries them. */
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'];

/** `./x.js` → `./x.ts`. */
const COMPILED: Record<string, string[]> = {
    '.cjs': ['.cts'],
    '.js': ['.ts', '.tsx'],
    '.jsx': ['.tsx'],
    '.mjs': ['.mts'],
};

function onDisk(path: string): string {
    if (isFile(path)) {
        return path;
    }
    // Stryker disable next-line Regex,StringLiteral: a module path ends on its extension, and no text the table lacks swaps
    const extension = /\.[cm]?jsx?$/u.exec(path)?.[0] ?? '';
    // Stryker disable next-line ArrayDeclaration,StringLiteral: an extension the table lacks swaps to nothing, and no swap of nothing names a file
    const swaps = COMPILED[extension] ?? [];
    const candidates = [
        ...swaps.map((swap) => path.slice(0, -extension.length) + swap),
        ...EXTENSIONS.map((added) => path + added),
        ...EXTENSIONS.map((added) => join(path, `index${added}`)),
    ];
    return candidates.find((candidate) => isFile(candidate)) ?? path;
}

function readJsonc(path: string): unknown {
    const text = readFileCached(path);
    // Stryker disable next-line ConditionalExpression,BlockStatement: an absent file's null fails the parse below, which answers the same
    if (text === null) {
        return undefined;
    }
    return parsedJson(blankComments(text).replaceAll(/,(?=\s*[\]}])/gu, ''), null);
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
    return isRecord(value) ? value : undefined;
}

function targetsOf(value: unknown): string[] {
    if (typeof value === 'string') {
        return [value];
    }
    if (Array.isArray(value)) {
        return value.flatMap((entry) => targetsOf(entry));
    }
    return Object.values(recordOf(value) ?? {}).flatMap((entry) => targetsOf(entry));
}

function substitution(key: string, specifier: string): string | undefined {
    const star = key.indexOf('*');
    if (star === -1) {
        // Stryker disable next-line StringLiteral: an exact entry's targets hold no star to fill
        return key === specifier ? '' : undefined;
    }
    const head = key.slice(0, star);
    const tail = key.slice(star + 1);
    return specifier.startsWith(head) &&
        specifier.endsWith(tail) &&
        specifier.length >= head.length + tail.length
        ? specifier.slice(head.length, specifier.length - tail.length)
        : undefined;
}

function mapped(map: Record<string, unknown>, specifier: string, base: string): string[] {
    for (const [key, value] of Object.entries(map)) {
        const star = substitution(key, specifier);
        if (star !== undefined) {
            return targetsOf(value).map((target) => resolve(base, target.replace('*', star)));
        }
    }
    return [];
}

function tsconfigOf(directory: string): string | undefined {
    const root = projectRootOf(directory);
    let current = directory;
    for (;;) {
        const candidate = join(current, 'tsconfig.json');
        if (isFile(candidate)) {
            return candidate;
        }
        const parent = dirname(current);
        if (current === root || parent === current) {
            return undefined;
        }
        current = parent;
    }
}

type PathsMap = { base: string; paths: Record<string, unknown> };

type Resolution = { baseUrl?: string; paths?: PathsMap };

/** In the compiler's order. */
function configCandidates(base: string): string[] {
    return [base, `${base}.json`, join(base, 'tsconfig.json')];
}

function extendedConfig(from: string, entry: string): string | undefined {
    const directory = dirname(from);
    if (entry.startsWith('.') || entry.startsWith('/')) {
        return configCandidates(resolve(directory, entry)).find((path) => isFile(path));
    }
    for (let current = directory; ; current = dirname(current)) {
        const found = configCandidates(join(current, 'node_modules', entry)).find((path) =>
            isFile(path),
        );
        if (found !== undefined || dirname(current) === current) {
            return found;
        }
    }
}

/** Folded the compiler's way: a later base overrides an earlier one, and `baseUrl` and `paths` resolve relative to the file stating them. */
function resolutionOf(tsconfig: string, seen: Set<string>): Resolution {
    if (seen.has(tsconfig)) {
        return {};
    }
    seen.add(tsconfig);
    const config = recordOf(readJsonc(tsconfig));
    const bases = targetsOf(config?.extends);
    const resolution: Resolution = {};
    for (const entry of bases) {
        const base = extendedConfig(tsconfig, entry);
        if (base !== undefined) {
            Object.assign(resolution, resolutionOf(base, seen));
        }
    }
    const options = recordOf(config?.compilerOptions);
    const directory = dirname(tsconfig);
    if (typeof options?.baseUrl === 'string') {
        resolution.baseUrl = resolve(directory, options.baseUrl);
    }
    const paths = recordOf(options?.paths);
    if (paths !== undefined) {
        resolution.paths = { base: directory, paths };
    }
    return resolution;
}

function throughPaths(directory: string, specifier: string): string[] {
    const tsconfig = tsconfigOf(directory);
    if (tsconfig === undefined) {
        return [];
    }
    const { baseUrl, paths } = resolutionOf(tsconfig, new Set());
    if (paths === undefined) {
        return [];
    }
    return mapped(paths.paths, specifier, baseUrl ?? paths.base);
}

function throughImports(directory: string, specifier: string): string[] {
    const root = packageRootOf(directory);
    if (root === undefined) {
        return [];
    }
    const manifest = recordOf(readJsonc(join(root, 'package.json')));
    const imports = recordOf(manifest?.imports);
    return imports === undefined ? [] : mapped(imports, specifier, root);
}

export function resolveSpecifier(from: string, specifier: string): string[] {
    const directory = dirname(from);
    if (specifier === '.' || specifier === '..' || /^\.\.?\//u.test(specifier)) {
        return [onDisk(resolve(directory, specifier))];
    }
    if (specifier.startsWith('/') || specifier.startsWith('node:')) {
        return [];
    }
    const targets = specifier.startsWith('#')
        ? throughImports(directory, specifier)
        : throughPaths(directory, specifier);
    return targets.map((target) => onDisk(target));
}
