import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AstNode } from '../../kit/project/ast.js';
import { callsOf } from '../../kit/project/call-shapes.js';
import { stringsOf, withoutComments } from '../../kit/project/source-scan.js';
import { sourcesUnder } from '../../kit/project/tree.js';
import type { Column } from './facet-matrix.js';

/** `files` serves the one column with no constructor: component's options are the project's, stated in this repository's `jterrazz.config.ts`. */
export const MATRIX_SOURCES_TREES: Record<
    Column,
    { extensions: string[]; files?: string[]; roots: string[] }
> = {
    api: { extensions: ['.spec.ts', '.spec.yaml', '.specification.ts'], roots: ['specs/api'] },
    cli: { extensions: ['.spec.ts', '.spec.yaml', '.specification.ts'], roots: ['specs/cli'] },
    component: {
        extensions: ['.test.tsx', '.specification.ts'],
        files: ['jterrazz.config.ts'],
        roots: ['specs/component'],
    },
    integration: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/integration'] },
    job: { extensions: ['.spec.ts', '.spec.yaml', '.specification.ts'], roots: ['specs/job'] },
    lint: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/lint'] },
    mobile: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/mobile'] },
    module: { extensions: ['.test.ts', '.test.tsx'], roots: ['src'] },
    website: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/website'] },
};

export type Source = {
    calls: AstNode[];
    strings: boolean[];
    text: string;
};

export function matrixSources(root: string): Record<Column, Source[]> {
    const read = (column: Column): Source[] => {
        const tree = MATRIX_SOURCES_TREES[column];
        return [
            ...tree.roots.flatMap((relative) =>
                sourcesUnder(resolve(root, relative), tree.extensions),
            ),
            ...(tree.files ?? []).map((relative) => resolve(root, relative)),
        ].map((path) => {
            const source = readFileSync(path, 'utf8');
            // invariant: a document's only comments are `#` lines, and an apostrophe in its prose is no quote.
            if (path.endsWith('.spec.yaml')) {
                return {
                    calls: [],
                    strings: [],
                    text: source.replaceAll(/^\s*#[^\n]*/gmu, ''),
                };
            }
            const text = withoutComments(source);
            return { calls: callsOf(path, source), strings: stringsOf(text), text };
        });
    };
    // invariant: written out rather than folded: the compiler then holds that every column has a tree.
    return {
        api: read('api'),
        cli: read('cli'),
        component: read('component'),
        integration: read('integration'),
        job: read('job'),
        lint: read('lint'),
        mobile: read('mobile'),
        module: read('module'),
        website: read('website'),
    };
}
