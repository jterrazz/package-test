import type { Context } from '@oxlint/plugins';
import { dirname, join, resolve } from 'node:path';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import type { Visitor } from '../../../engine/project/ast.js';
import { isDirectory } from '../../../engine/project/fs-cache.js';
import { isProductionFile } from '../../../engine/project/linted-file.js';
import { moduleReferenceVisitor } from '../../../engine/project/production.js';
import { projectRootOf, projectSegments } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { consumerRows } from '../../catalogue/manifest.js';

export type LayerOptions = {
    /** Each key a direct child folder of the layer, its value the packages that folder may import. */
    folders?: Record<string, string[]>;
    /** A prefix when it ends with `/`, an exact module path otherwise. */
    imports?: string[];
    /** Whole name, or `<name>/…`. */
    packages?: string[];
    /** The lazy seam a layer opens once. */
    seams?: Record<string, string[]>;
};

type Options = { layers?: Record<string, LayerOptions> };

function matchesPackage(source: string, packages: string[]): boolean {
    return packages.some((name) => source === name || source.startsWith(`${name}/`));
}

/** Relative to the last `src` segment, or `lint/…` for a root `lint/` beside a `src/`; `undefined` anywhere else. */
function pathInLayers(path: string): string | undefined {
    const parts = projectSegments(path);
    const srcIndex = parts.lastIndexOf('src');
    if (srcIndex !== -1) {
        return parts.slice(srcIndex + 1).join('/');
    }
    const lintIndex = parts.lastIndexOf('lint');
    const base = projectRootOf(dirname(path)) ?? (path.startsWith('/') ? '/' : '');
    const besideSrc = isDirectory(join(base, ...parts.slice(0, lintIndex), 'src'));
    return lintIndex === -1 || !besideSrc ? undefined : parts.slice(lintIndex).join('/');
}

function withoutExtension(path: string): string {
    return path.replace(/\.[cm]?[jt]sx?$/u, '');
}

function matchesPath(target: string, patterns: string[]): boolean {
    return patterns.some((pattern) =>
        pattern.endsWith('/')
            ? target.startsWith(pattern)
            : withoutExtension(target) === withoutExtension(pattern),
    );
}

type Boundary = {
    allowsExternal: (source: string) => boolean;
    allowsInternal: (target: string) => boolean;
    layer: string;
};

function boundaryOf(context: Context): Boundary | undefined {
    const layers = (context.options[0] as Options | undefined)?.layers;
    if (layers === undefined || Object.keys(layers).length === 0) {
        return undefined;
    }
    if (!isProductionFile(context)) {
        return undefined;
    }
    const inside = pathInLayers(context.physicalFilename);
    const layer = inside?.split('/')[0];
    const rules = layer === undefined ? undefined : layers[layer];
    if (inside === undefined || layer === undefined || rules === undefined) {
        return undefined;
    }
    const folder = rules.folders === undefined ? undefined : inside.split('/')[1];
    const ownPackages = [...(rules.packages ?? []), ...(rules.folders?.[folder ?? ''] ?? [])];
    const ownImports = [...(rules.imports ?? []), ...(rules.seams?.[inside] ?? [])];
    return {
        allowsExternal: (source) => matchesPackage(source, ownPackages),
        allowsInternal: (target) =>
            matchesPath(target, ownImports) ||
            // A folder always owns its own files.
            (folder !== undefined && target.startsWith(`${layer}/${folder}/`)),
        layer,
    };
}

/** Inert with no layer map, and it ships none: an architecture is the project's to state. */
export const importWithinDeclaredLayers: LintRule = {
    createOnce(context: Context): Visitor {
        let boundary: Boundary | undefined;
        return {
            ...moduleReferenceVisitor(({ node, source }) => {
                if (boundary === undefined || source.startsWith('node:')) {
                    return;
                }
                const { allowsExternal, allowsInternal, layer } = boundary;
                let messageId: null | string;
                if (source.startsWith('.')) {
                    const target = pathInLayers(resolve(dirname(context.physicalFilename), source));
                    messageId =
                        target === undefined || !allowsInternal(target) ? 'crossLayer' : null;
                } else {
                    messageId = allowsExternal(source) ? null : 'foreignDependency';
                }
                if (messageId !== null) {
                    context.report({ data: { layer, source }, messageId, node });
                }
            }),
            before() {
                boundary = boundaryOf(context);
                return boundary !== undefined;
            },
        };
    },
    meta: {
        defaultOptions: [{ layers: {} }],
        docs: rowNamed(consumerRows, 'import-within-declared-layers'),
        messages: lessonsAt(rowNamed(consumerRows, 'import-within-declared-layers'), {
            crossLayer: {
                found: 'the layer "{{layer}}" imports "{{source}}", outside the edges its map declares',
                fix: 'reach it through a layer the map allows, or declare the edge in the layer map with the reason',
            },
            foreignDependency: {
                found: '"{{source}}" is not a dependency the layer "{{layer}}" declares',
                fix: 'import it from the seam that owns it, or declare it on the layer with the reason',
            },
        }),
        schema: [
            {
                additionalProperties: false,
                properties: {
                    layers: {
                        additionalProperties: {
                            additionalProperties: false,
                            properties: {
                                folders: {
                                    additionalProperties: {
                                        items: { type: 'string' },
                                        type: 'array',
                                    },
                                    type: 'object',
                                },
                                imports: { items: { type: 'string' }, type: 'array' },
                                packages: { items: { type: 'string' }, type: 'array' },
                                seams: {
                                    additionalProperties: {
                                        items: { type: 'string' },
                                        type: 'array',
                                    },
                                    type: 'object',
                                },
                            },
                            type: 'object',
                        },
                        type: 'object',
                    },
                },
                type: 'object',
            },
        ],
        type: 'problem',
    },
};
