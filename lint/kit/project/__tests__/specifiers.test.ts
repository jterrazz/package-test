import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { resolveSpecifier } from '../specifiers.js';

const ROOT = packageWith({
    'package.json': JSON.stringify({
        imports: { '#data/*': { default: './specs/__fixtures__/*' } },
    }),
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
        compilerOptions: { paths: { '@data/*': ['specs/__fixtures__/*'] } },
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
            join(EXTENDED, 'apps/web/specs/__fixtures__/users.js'),
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
            join(ROOT, 'specs/__fixtures__/users.js'),
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

    test('a relative path names the file itself first, then its compiled source, an extension, or an index', () => {
        // Given - files a relative import reaches each way
        const root = packageWith({
            'package.json': '{}',
            'src/bare': 'x\n',
            'src/bare.ts': 'x\n',
            'src/lib/index.ts': 'x\n',
            'src/module.mts': 'x\n',
            'src/page.ts': 'x\n',
        });
        const from = join(root, 'src/page.ts');

        // Then - the first that exists, in the resolver's order
        expect(
            ['./bare', './module.mjs', './lib', '.', '..', './gone.js'].map((specifier) =>
                resolveSpecifier(from, specifier),
            ),
        ).toStrictEqual([
            [join(root, 'src/bare')],
            [join(root, 'src/module.mts')],
            [join(root, 'src/lib/index.ts')],
            [join(root, 'src')],
            [root],
            [join(root, 'src/gone.js')],
        ]);
    });

    test('an import map entry is exact or a pattern, its star the part between the head and the tail', () => {
        // Given - exact and pattern entries, one with a tail, one whose ends overlap
        const root = packageWith({
            'package.json': JSON.stringify({
                imports: {
                    '#app/*.js': './src/*.ts',
                    '#config': './config.ts',
                    '#x*x': './x.ts',
                    '#lib/*': './src/*',
                },
            }),
            'src/a.ts': 'x\n',
        });
        const from = join(root, 'src/a.ts');

        // Then - each resolves where its entry says, and a specifier its ends overlap matches nothing
        expect(
            ['#app/a.js', '#config', '#lib/', '#x', '#gone'].map((specifier) =>
                resolveSpecifier(from, specifier),
            ),
        ).toStrictEqual([
            [join(root, 'src/a.ts')],
            [join(root, 'config.ts')],
            [join(root, 'src')],
            [],
            [],
        ]);
    });

    test('no alias resolves without the config that states it, and none outside its project', () => {
        // Given - a package with no tsconfig under a folder that has one, a package with no manifest imports, and a tsconfig with no paths
        const outer = packageWith({
            'pkg/package.json': '{}',
            'plain/package.json': '{}',
            'plain/tsconfig.json': '{ "compilerOptions": { "baseUrl": "." } }',
            'tsconfig.json': '{ "compilerOptions": { "paths": { "@/*": ["*"] } } }',
        });

        // Then - nothing for each
        expect([
            resolveSpecifier(join(outer, 'pkg/src/a.ts'), '@/x'),
            resolveSpecifier(join(outer, 'pkg/src/a.ts'), '#x'),
            resolveSpecifier(join(outer, 'plain/a.ts'), '@/x'),
            resolveSpecifier(join(outer, 'plain/a.ts'), '/abs/x.ts'),
            resolveSpecifier('/nowhere/a.ts', '#x'),
            resolveSpecifier('/nowhere/a.ts', '@/x'),
        ]).toStrictEqual([[], [], [], [], [], []]);
    });

    test('a config extends a directory, an absolute path or a package up the tree, and survives one it cannot read', () => {
        // Given - configs reaching their bases each way, one base missing, and one unreadable
        const root = packageWith({
            'configs/tsconfig.json': JSON.stringify({
                compilerOptions: { paths: { '@dir/*': ['./dir/*'] } },
            }),
            'node_modules/@org/base/tsconfig.json': JSON.stringify({
                compilerOptions: { paths: { '@pkg/*': ['./pkg/*'] } },
            }),
            'package.json': '{}',
            'tsconfig.json': JSON.stringify({
                compilerOptions: { paths: { '@/./*': ['./src/*'] } },
                extends: ['./configs', '@missing/base'],
            }),
        });
        const deep = packageWith({
            'apps/web/package.json': '{}',
            'apps/web/tsconfig.json': JSON.stringify({ extends: '@org/base' }),
            'node_modules/@org/base/tsconfig.json': JSON.stringify({
                compilerOptions: { paths: { '@pkg/*': ['./pkg/*'] } },
            }),
            'package.json': '{}',
        });
        const absolute = packageWith({ 'package.json': '{}', 'tsconfig.json': '{}' });
        const unreadable = packageWith({
            'package.json': '{}',
            'tsconfig.json': '{ "compilerOptions": null, ',
        });
        writeFileSync(
            join(absolute, 'tsconfig.json'),
            JSON.stringify({ extends: join(root, 'configs/tsconfig.json') }),
        );

        // Then - each base's alias, read beside the base that states it
        expect([
            resolveSpecifier(join(root, 'a.ts'), '@/./x.ts'),
            resolveSpecifier(join(deep, 'apps/web/a.ts'), '@pkg/x.ts'),
            resolveSpecifier(join(absolute, 'a.ts'), '@dir/x.ts'),
            resolveSpecifier(join(unreadable, 'a.ts'), '@/x'),
        ]).toStrictEqual([
            [join(root, 'src/x.ts')],
            [join(deep, 'node_modules/@org/base/pkg/x.ts')],
            [join(root, 'configs/dir/x.ts')],
            [],
        ]);
    });

    test('a config whose options are null states no alias', () => {
        // Given - a config with null options
        const root = packageWith({
            'package.json': '{}',
            'tsconfig.json': '{ "compilerOptions": null }',
        });

        // Then - nothing resolves through it
        expect(resolveSpecifier(join(root, 'a.ts'), '@/x')).toStrictEqual([]);
    });

    test('an absolute path or a builtin is never mapped, even by a catch-all alias, and an unreadable manifest maps nothing', () => {
        // Given - a config mapping every specifier, and a package whose manifest does not parse
        const root = packageWith({
            'package.json': '{}',
            'tsconfig.json': JSON.stringify({
                compilerOptions: { paths: { '*': ['./vendor/*'] } },
            }),
        });
        const broken = packageWith({ 'package.json': '{ "imports": ' });

        // Then - nothing for each
        expect([
            resolveSpecifier(join(root, 'a.ts'), '/abs/x.ts'),
            resolveSpecifier(join(root, 'a.ts'), 'node:fs'),
            resolveSpecifier(join(broken, 'a.ts'), '#x'),
        ]).toStrictEqual([[], [], []]);
    });
});
