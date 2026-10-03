import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../testing/package-tree.fixtures.js';
import { resolveSpecifier } from './specifiers.js';

const ROOT = packageWith({
    'package.json': JSON.stringify({ imports: { '#data/*': { default: './specs/_fixtures/*' } } }),
    'src/domain/order.ts': 'export const order = 1;\n',
    'tsconfig.json': '{ "compilerOptions": { "baseUrl": "./src", "paths": { "@/*": ["*"] } } }',
});

const EXTENDED = packageWith({
    'apps/web/package.json': '{}',
    'apps/web/tsconfig.json': JSON.stringify({
        extends: ['@org/config/tsconfig', './tsconfig.app.json'],
    }),
    'apps/web/tsconfig.app.json': [
        '{',
        '    // The app config, itself built on the repository base.',
        '    "extends": "../../tsconfig.base",',
        '    "compilerOptions": { "baseUrl": "." },',
        '}',
    ].join('\n'),
    'node_modules/@org/config/tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '@shared/*': ['./shared/*'] } },
    }),
    'package.json': '{}',
    'tsconfig.base.json': JSON.stringify({
        compilerOptions: { paths: { '@data/*': ['specs/_fixtures/*'] } },
        extends: './tsconfig.json',
    }),
    'tsconfig.json': JSON.stringify({ extends: './tsconfig.base.json' }),
});

describe('resolveSpecifier', () => {
    test('follows `paths` through the `extends` chain, the last base winning, the baseUrl read where it is stated', () => {
        // Given - a module of the app, whose aliases come from two levels up the chain
        const from = join(EXTENDED, 'apps/web/src/page.ts');

        // Then - the repository base's alias, read from the app's own baseUrl; a cycle ends; the earlier base is overridden
        expect(resolveSpecifier(from, '@data/users.js')).toStrictEqual([
            join(EXTENDED, 'apps/web/specs/_fixtures/users.js'),
        ]);
        expect(resolveSpecifier(from, '@shared/x.js')).toStrictEqual([]);
    });

    test('reads a base config from a package when no relative one states the paths', () => {
        // Given - a module of an app extending only the package config
        const root = packageWith({
            'node_modules/@org/config/tsconfig.json': JSON.stringify({
                compilerOptions: { paths: { '@shared/*': ['./shared/*'] } },
            }),
            'package.json': '{}',
            'tsconfig.json': JSON.stringify({ extends: '@org/config/tsconfig' }),
        });

        // Then - the alias resolves beside the config that states it
        expect(resolveSpecifier(join(root, 'src/a.ts'), '@shared/x.js')).toStrictEqual([
            join(root, 'node_modules/@org/config/shared/x.js'),
        ]);
    });

    test('follows a relative path, a `paths` alias and an `imports` entry', () => {
        // Given - a module in the package
        const from = join(ROOT, 'src/domain/order.ts');

        // Then - the file on disk where there is one, else the path the specifier names
        expect(resolveSpecifier(from, './order.js')).toStrictEqual([from]);
        expect(resolveSpecifier(from, '@/domain/order')).toStrictEqual([from]);
        expect(resolveSpecifier(from, '#data/users.js')).toStrictEqual([
            join(ROOT, 'specs/_fixtures/users.js'),
        ]);
    });

    test('names no local file for a package or a builtin', () => {
        // Given - a module in the package
        const from = join(ROOT, 'src/domain/order.ts');

        // Then - nothing: a package is judged by its name, never by a path
        expect([
            ...resolveSpecifier(from, 'node:fs'),
            ...resolveSpecifier(from, 'zod'),
        ]).toStrictEqual([]);
    });
});
